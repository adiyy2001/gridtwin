#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  echo "usage: tools/bench.sh java [--quick]" >&2
  exit 2
}

run_java() {
  cd "$ROOT"
  ./mvnw -B -ntp -q -pl bench -am -DskipTests package
  local classpath
  classpath="$(cat bench/target/classpath.txt)"
  java -cp "bench/target/classes:${classpath}" dev.gridtwin.bench.BenchMain --output "$ROOT/bench/results" "$@"
}

[ "$#" -ge 1 ] || usage
suite="$1"
shift
case "$suite" in
  java) run_java "$@" ;;
  web)
    echo "the web benchmarks arrive with milestone 8" >&2
    exit 1
    ;;
  *) usage ;;
esac
