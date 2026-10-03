#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC="$ROOT/docs/api/openapi.json"
GENERATOR="openapi-typescript@7.13.0"

if [ "${1:-}" = "--refresh" ]; then
  cd "$ROOT"
  ./mvnw -B -ntp -q -pl api -am verify -Dgridtwin.openapi.update=true
fi

if [ -d "$ROOT/web" ]; then
  OUTPUT="$ROOT/web/src/app/model/api-schema.ts"
else
  OUTPUT="$ROOT/tools/.cache/web/src/app/model/api-schema.ts"
fi

mkdir -p "$(dirname "$OUTPUT")"
npx --yes "$GENERATOR" "$SPEC" --output "$OUTPUT"
node "$ROOT/tools/strip-comments.mjs" "$OUTPUT"
echo "wrote $OUTPUT"
