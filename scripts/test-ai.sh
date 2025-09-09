#!/usr/bin/env bash
set -euo pipefail

echo "# explain-alert"
curl -s -X POST http://localhost:4000/v1/ai/explain-alert \
  -H 'Content-Type: application/json' \
  -d '{"tx_id":1}' | jq . || true

echo "# copilot"
curl -s -X POST http://localhost:4000/v1/ai/copilot \
  -H 'Content-Type: application/json' \
  -d '{"question":"Quels dossiers à risque élevé cette semaine ?"}' | jq . || true

