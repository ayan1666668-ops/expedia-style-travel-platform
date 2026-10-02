#!/usr/bin/env bash
#
# Open a public preview of the running storefront.
#
# This is a GitHub Codespace. Only ONE forwarded port is needed: the storefront
# on 3000 also serves the API under /api/v1, /media and /health, proxied by
# Next.js (see apps/web/next.config.ts). Keeping the visitor on a single origin
# removes CORS from the picture entirely.
#
# The script prints the URL, verifies it answers, and optionally opens it.
#
# Usage:
#   bash scripts/preview.sh          # print URLs and check health
#   bash scripts/preview.sh --open   # also open the storefront in a browser

set -uo pipefail

CS="${CODESPACE_NAME:-${GITHUB_CODESPACE_NAME:-}}"

if [[ -z "$CS" ]]; then
  cat <<'MSG'
Could not determine the codespace name.

Set it explicitly, or run this inside a GitHub Codespace:

  CODESPACE_NAME=my-codespace bash scripts/preview.sh
MSG
  exit 1
fi

WEB="https://${CS}-3000.app.github.dev"

# The tunnel can take a few seconds to attach after the service starts, so give
# each endpoint a couple of attempts before declaring it down.
wait_for() {
  local url="$1" label="$2"
  for _ in 1 2 3 4 5; do
    if [[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$url")" == "200" ]]; then
      printf '  \033[32m✓\033[0m %-6s %s\n' "$label" "$url"
      return 0
    fi
    sleep 2
  done
  printf '  \033[31m✗\033[0m %-6s %s (not responding)\n' "$label" "$url"
  return 1
}

echo
printf '\033[1mEasyTrip — public preview\033[0m\n'
printf 'codespace: %s\n\n' "$CS"

wait_for "$WEB/" "web" || FAILED=1
wait_for "$WEB/health" "api" || FAILED=1

if [[ "${FAILED:-0}" == "1" ]]; then
  cat <<'MSG'

The tunnel is not answering. Check that both services are running:

  pnpm dev:api     # API on :4000
  pnpm dev:web     # web on :3000

Then confirm port 3000 is forwarded and Public:

  gh codespace ports -c <codespace-name>
  gh codespace ports visibility 3000:public -c <codespace-name>

MSG
  exit 1
fi

cat <<MSG

\033[1mPages\033[0m
  storefront     $WEB/
  search         $WEB/search
  products       $WEB/search?destination=paris
  loyalty        $WEB/loyalty

\033[1mStaff\033[0m
  dashboard      $WEB/admin
  finance        $WEB/admin/finance
  gate scanner   $WEB/admin/scan

\033[1mAccounts\033[0m  (password: Password123!)
  admin          admin@easytrip.test
  support        support@easytrip.test
  operator       operator@easytrip.test
  traveler       traveler@easytrip.test

\033[1mAPI\033[0m  (same origin, proxied by the storefront)
  health         $WEB/health
  readiness      $WEB/ready
  search         $WEB/api/v1/search?pageSize=3

MSG

if [[ "${1:-}" == "--open" ]]; then
  if [[ -n "${BROWSER:-}" ]]; then
    "$BROWSER" "$WEB/" >/dev/null 2>&1 &
    echo "Opened $WEB/ in the default browser."
  else
    echo "No \$BROWSER set — open the storefront URL above manually."
  fi
fi