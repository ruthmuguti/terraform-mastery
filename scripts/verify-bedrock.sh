#!/usr/bin/env bash
# Quick check that Bedrock Anthropic access is live for this account.
# Run after submitting the Anthropic use-case form in the Bedrock console.
#   AWS_PROFILE=ruth-terraform ./scripts/verify-bedrock.sh
set -euo pipefail

REGION="${BEDROCK_REGION:-eu-west-1}"
MODEL="${BEDROCK_MODEL_ID:-eu.anthropic.claude-haiku-4-5-20251001-v1:0}"

echo "Region: $REGION"
echo "Model:  $MODEL"
echo

printf '{"anthropic_version":"bedrock-2023-05-31","max_tokens":20,"messages":[{"role":"user","content":"Reply with exactly: TUTOR OK"}]}' > /tmp/bedrock_verify.json

if aws bedrock-runtime invoke-model \
  --region "$REGION" \
  --model-id "$MODEL" \
  --body fileb:///tmp/bedrock_verify.json \
  --cli-binary-format raw-in-base64-out \
  /tmp/bedrock_verify_out.json 2>/tmp/bedrock_verify_err.txt; then
  echo "✅ Bedrock access is LIVE. Model replied:"
  cat /tmp/bedrock_verify_out.json | python3 -c "import sys,json;print('   '+json.load(sys.stdin)['content'][0]['text'])" 2>/dev/null || cat /tmp/bedrock_verify_out.json
else
  echo "❌ Still blocked:"
  cat /tmp/bedrock_verify_err.txt
  exit 1
fi
