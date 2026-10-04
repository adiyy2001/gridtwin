#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

./mvnw -B -ntp -q -DskipTests \
  -DincludedScopes=runtime -Dlicense.excludedScopes=test,provided \
  -pl api -am package \
  org.codehaus.mojo:license-maven-plugin:2.7.1:download-licenses
node tools/third-party-licenses.ts "$@"
