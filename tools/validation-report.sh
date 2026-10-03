#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

./mvnw -B -ntp -q -pl validation -am test -Dtest=ValidationReportTest -Dsurefire.failIfNoSpecifiedTests=false
mkdir -p bench/results
cp validation/target/validation-report.json bench/results/validation.json
node tools/validation-summary.ts bench/results/validation.json
