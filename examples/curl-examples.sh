#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-http://localhost:4000}"

printf '\n== Healthcheck ==\n'
curl --silent --show-error "$BASE_URL/health"
printf '\n\n== Sucesso ==\n'
curl --silent --show-error \
  --request POST "$BASE_URL/v1/analyze" \
  --header 'Content-Type: application/json' \
  --header 'x-mock-scenario: success' \
  --data-raw '{
    "review_id": "review-curl-001",
    "company_id": "company-001",
    "rating": 2,
    "text": "O pedido demorou muito e chegou frio."
  }'
printf '\n\n== Erro temporário ==\n'
curl --silent --show-error --include \
  --request POST "$BASE_URL/v1/analyze" \
  --header 'Content-Type: application/json' \
  --header 'x-mock-scenario: server-error' \
  --data-raw '{
    "review_id": "review-curl-002",
    "rating": 1,
    "text": "O atendimento foi péssimo."
  }'
printf '\n'
