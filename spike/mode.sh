#!/bin/bash
# Bascule la Lambda du spike entre les modes "echo" et "claude", sans toucher aux autres variables.
# Usage : spike/mode.sh echo|claude
set -euo pipefail

REGION=eu-west-1
FUNCTION=alexa-claude-spike
MODE=${1:?Usage : spike/mode.sh echo|claude}
[[ "$MODE" == echo || "$MODE" == claude ]] || { echo "Mode inconnu : $MODE" >&2; exit 1; }

VARS=$(aws lambda get-function-configuration --function-name "$FUNCTION" --region "$REGION" \
  --query 'Environment.Variables' --output json | jq -c --arg m "$MODE" '. + {MODE: $m}')
aws lambda update-function-configuration --function-name "$FUNCTION" --region "$REGION" \
  --environment "{\"Variables\": $VARS}" >/dev/null
aws lambda wait function-updated --function-name "$FUNCTION" --region "$REGION"
echo "Mode : $MODE"
