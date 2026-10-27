#!/bin/bash
# Mesure la latence de Claude depuis la Lambda (sans Alexa).
# Usage : spike/bench.sh [disabled|adaptive]
set -euo pipefail

REGION=eu-west-1
FUNCTION=alexa-claude-spike
THINKING=${1:-disabled}
OUT=$(mktemp)

QUESTIONS=(
  "pourquoi le ciel est bleu"
  "comment fait-on une pâte à crêpes"
  "qui a inventé l'imprimerie"
  "quelle est la différence entre un virus et une bactérie"
  "combien de temps faut-il pour aller sur Mars"
  "explique-moi la photosynthèse"
  "quand a été construite la tour Eiffel"
  "est-ce que les chats voient dans le noir"
  "donne-moi une idée de dîner rapide avec des pâtes"
  "qu'est-ce que l'inflation"
)

echo "Réflexion : $THINKING"
printf "%-55s %8s %-11s %s\n" "question" "claudeMs" "stop" "tokens in/out"
for q in "${QUESTIONS[@]}"; do
  payload=$(jq -nc --arg q "$q" --arg t "$THINKING" '{bench: {question: $q, thinking: $t}}')
  aws lambda invoke --function-name "$FUNCTION" --region "$REGION" \
    --cli-binary-format raw-in-base64-out --payload "$payload" "$OUT" >/dev/null
  if jq -e '.errorMessage' "$OUT" >/dev/null; then
    printf "%-55s ERREUR %s\n" "$q" "$(jq -r '.errorMessage' "$OUT")"
    continue
  fi
  printf "%-55s %8s %-11s %s/%s\n" "$q" "$(jq -r .claudeMs "$OUT")" "$(jq -r .stopReason "$OUT")" \
    "$(jq -r .usage.input_tokens "$OUT")" "$(jq -r .usage.output_tokens "$OUT")"
  jq -r .claudeMs "$OUT" >> "$OUT.ms"
done

sort -n "$OUT.ms" | awk '{ a[NR] = $1 } END {
  if (NR == 0) exit;
  p50 = a[int((NR + 1) / 2)]; p95 = a[int(NR * 0.95 + 0.999)];
  printf "\np50 = %d ms · p95 = %d ms · max = %d ms (n = %d)\n", p50, p95, a[NR], NR }'
rm -f "$OUT" "$OUT.ms"
