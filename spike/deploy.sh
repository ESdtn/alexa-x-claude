#!/bin/bash
# Déploie (ou met à jour) la Lambda du spike dans eu-west-1.
# Usage : spike/deploy.sh [SKILL_ID]
#   Sans SKILL_ID : crée/actualise la fonction et affiche son ARN.
#   Avec SKILL_ID : ajoute aussi la permission d'invocation Alexa limitée à ce skill ID.
set -euo pipefail

REGION=eu-west-1
FUNCTION=alexa-claude-spike
ROLE=alexa-claude-spike
PARAM=/alexa-claude/anthropic-api-key
SKILL_ID=${1:-}
DIR=$(cd "$(dirname "$0")" && pwd)
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  echo "→ Création du rôle IAM $ROLE"
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{ "Effect": "Allow", "Principal": { "Service": "lambda.amazonaws.com" }, "Action": "sts:AssumeRole" }]
  }' >/dev/null
  aws iam attach-role-policy --role-name "$ROLE" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  aws iam put-role-policy --role-name "$ROLE" --policy-name read-anthropic-key --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      { \"Effect\": \"Allow\", \"Action\": \"ssm:GetParameter\", \"Resource\": \"arn:aws:ssm:$REGION:$ACCOUNT:parameter$PARAM\" },
      { \"Effect\": \"Allow\", \"Action\": \"kms:Decrypt\", \"Resource\": \"*\",
        \"Condition\": { \"StringEquals\": { \"kms:ViaService\": \"ssm.$REGION.amazonaws.com\" } } }
    ]
  }"
  echo "  (attente de la propagation IAM)"
  sleep 10
fi

echo "→ Empaquetage"
(cd "$DIR/lambda" && npm ci --omit=dev --silent)
rm -f "$DIR/function.zip"
(cd "$DIR/lambda" && zip -qr "$DIR/function.zip" index.mjs carriers.mjs package.json node_modules)
(cd "$DIR/lambda" && npm install --silent) # remet les devDependencies pour les tests locaux

ENV="Variables={MODE=echo,CLAUDE_MODEL=claude-haiku-5-5,CLAUDE_MAX_TOKENS=300,CLAUDE_TIMEOUT_MS=6500,CLAUDE_THINKING=disabled,CLAUDE_EFFORT=low${SKILL_ID:+,SKILL_ID=$SKILL_ID}}"

if aws lambda get-function --function-name "$FUNCTION" --region "$REGION" >/dev/null 2>&1; then
  echo "→ Mise à jour du code"
  aws lambda update-function-code --function-name "$FUNCTION" --region "$REGION" \
    --zip-file "fileb://$DIR/function.zip" >/dev/null
  aws lambda wait function-updated --function-name "$FUNCTION" --region "$REGION"
  if [ -n "$SKILL_ID" ]; then
    # Conserve le MODE en place, n'ajoute que le SKILL_ID.
    MODE=$(aws lambda get-function-configuration --function-name "$FUNCTION" --region "$REGION" \
      --query 'Environment.Variables.MODE' --output text)
    aws lambda update-function-configuration --function-name "$FUNCTION" --region "$REGION" \
      --environment "${ENV/MODE=echo/MODE=$MODE}" >/dev/null
    aws lambda wait function-updated --function-name "$FUNCTION" --region "$REGION"
  fi
else
  echo "→ Création de la fonction $FUNCTION"
  aws lambda create-function --function-name "$FUNCTION" --region "$REGION" \
    --runtime nodejs22.x --architectures arm64 --memory-size 512 --timeout 8 \
    --handler index.handler --role "arn:aws:iam::$ACCOUNT:role/$ROLE" \
    --zip-file "fileb://$DIR/function.zip" --environment "$ENV" >/dev/null
  aws lambda wait function-active-v2 --function-name "$FUNCTION" --region "$REGION"
  aws logs create-log-group --log-group-name "/aws/lambda/$FUNCTION" --region "$REGION" 2>/dev/null || true
  aws logs put-retention-policy --log-group-name "/aws/lambda/$FUNCTION" --retention-in-days 14 --region "$REGION"
fi

if [ -n "$SKILL_ID" ]; then
  echo "→ Permission d'invocation Alexa pour $SKILL_ID"
  aws lambda remove-permission --function-name "$FUNCTION" --region "$REGION" --statement-id alexa-skill 2>/dev/null || true
  aws lambda add-permission --function-name "$FUNCTION" --region "$REGION" --statement-id alexa-skill \
    --action lambda:InvokeFunction --principal alexa-appkit.amazon.com --event-source-token "$SKILL_ID" >/dev/null
fi

echo
echo "ARN à coller dans la console Alexa (Endpoint → Default Region) :"
aws lambda get-function --function-name "$FUNCTION" --region "$REGION" --query 'Configuration.FunctionArn' --output text
