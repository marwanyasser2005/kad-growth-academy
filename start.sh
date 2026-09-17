#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' "Node.js 20 or newer is required."
  exit 1
fi
exec node scripts/serve.mjs --dist
