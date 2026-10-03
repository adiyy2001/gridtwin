#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATIC_DIR="$ROOT/api/src/main/resources/META-INF/resources"

cd "$ROOT"
pnpm install --frozen-lockfile
pnpm --dir web run build

rm -rf "$STATIC_DIR"
mkdir -p "$STATIC_DIR"
cp -R web/dist/web/browser/. "$STATIC_DIR/"

./mvnw -B -ntp -T 1 -pl api -am package -DskipTests
echo "built $ROOT/api/target/quarkus-app/quarkus-run.jar with the web application inside"
