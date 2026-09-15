#!/bin/sh
set -eu

: "${SUBS_CHECK_CALLBACK_TOKEN:?SUBS_CHECK_CALLBACK_TOKEN is required}"
: "${SUCCESS_COUNT:=0}"

COLLECTOR_NOTIFY_URL="${COLLECTOR_NOTIFY_URL:-http://172.17.0.1:8198/internal/notify/subs-check}"
payload=$(printf '{"successCount":%s}' "$SUCCESS_COUNT")

wget \
  -q \
  -T 10 \
  -O /dev/null \
  --header "Content-Type: application/json" \
  --header "X-Callback-Token: $SUBS_CHECK_CALLBACK_TOKEN" \
  --post-data "$payload" \
  "$COLLECTOR_NOTIFY_URL"
