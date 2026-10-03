#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  echo "usage: tools/bench.sh java|web [--quick] [--gpu]" >&2
  exit 2
}

run_java() {
  cd "$ROOT"
  ./mvnw -B -ntp -q -pl bench -am -DskipTests package
  local classpath
  classpath="$(cat bench/target/classpath.txt)"
  java -cp "bench/target/classes:${classpath}" dev.gridtwin.bench.BenchMain --output "$ROOT/bench/results" "$@"
}

run_web() {
  cd "$ROOT"
  local script
  for script in command-latency fps; do
    node e2e/scripts/with-server.mjs -- node "$ROOT/bench/web/${script}.mjs" "$@"
  done
}

[ "$#" -ge 1 ] || usage
suite="$1"
shift
case "$suite" in
  java) run_java "$@" ;;
  web) run_web "$@" ;;
  *) usage ;;
esac
