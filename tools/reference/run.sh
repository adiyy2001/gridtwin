#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: tools/reference/run.sh [--check] [all|cases|references|n1]" >&2
  exit 2
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CACHE="$ROOT/.cache"
MATPOWER_VERSION="8.1"
MATPOWER_SHA256="aebdc566e7d09a747c9197e7f69815e00cfe1d84db980d2121821b99b679c383"
MATPOWER_URL="https://github.com/MATPOWER/matpower/archive/refs/tags/${MATPOWER_VERSION}.zip"
OCTAVE_IMAGE="gnuoctave/octave:11.3.0"
CASES_DIR="$ROOT/cases/src/main/resources/cases"
REFERENCES_DIR="$ROOT/validation/src/test/resources/reference"
N1_DIR="$REFERENCES_DIR/n1"

mode="generate"
target="all"
for argument in "$@"; do
  case "$argument" in
    --check) mode="check" ;;
    all|cases|references|n1) target="$argument" ;;
    *) usage ;;
  esac
done

fetch_matpower() {
  local archive="$CACHE/matpower-${MATPOWER_VERSION}.zip"
  local directory="$CACHE/matpower-${MATPOWER_VERSION}"
  mkdir -p "$CACHE"
  if [ ! -d "$directory" ]; then
    if [ ! -f "$archive" ]; then
      curl -fsSL -o "$archive" "$MATPOWER_URL"
    fi
    echo "${MATPOWER_SHA256}  ${archive}" | sha256sum --check --status
    unzip -q -o "$archive" -d "$CACHE"
  fi
  MATPOWER_DIRECTORY="$directory"
}

run_octave() {
  local script="$1"
  local output="$2"
  mkdir -p "$output"
  docker run --rm --name gridtwin-octave \
    --user "$(id -u):$(id -g)" \
    --memory 3g \
    -e HOME=/tmp \
    -e MATPOWER_DIR=/opt/matpower \
    -e MATPOWER_VERSION="$MATPOWER_VERSION" \
    -e MATPOWER_SHA256="$MATPOWER_SHA256" \
    -e OCTAVE_IMAGE="$OCTAVE_IMAGE" \
    -e OUT_DIR=/out \
    -v "$MATPOWER_DIRECTORY":/opt/matpower:ro \
    -v "$ROOT/tools/reference":/work:ro \
    -v "$output":/out \
    -w /work \
    "$OCTAVE_IMAGE" \
    octave-cli --no-gui "/work/$script" \
    2> >(grep -v -e 'error caught while executing handle class delete method' -e 'method delete: conflicting definitions' >&2)
}

settle() {
  local staged="$1"
  local destination="$2"
  if [ "$mode" = "check" ]; then
    node "$ROOT/tools/reference/compare.ts" "$destination" "$staged"
  else
    mkdir -p "$destination"
    find "$destination" -maxdepth 1 -name '*.json' ! -name '*.substation.json' -delete
    cp "$staged"/*.json "$destination"/
    echo "wrote $(find "$destination" -maxdepth 1 -name '*.json' | wc -l) files to ${destination#"$ROOT"/}"
  fi
}

run_target() {
  local script="$1"
  local destination="$2"
  local staged
  staged="$(mktemp -d "$CACHE/stage.XXXXXX")"
  trap 'rm -rf "$staged"' RETURN
  run_octave "$script" "$staged"
  settle "$staged" "$destination"
}

fetch_matpower
if [ "$target" = "all" ] || [ "$target" = "cases" ]; then
  run_target export_case.m "$CASES_DIR"
fi
if [ "$target" = "all" ] || [ "$target" = "references" ]; then
  run_target generate_references.m "$REFERENCES_DIR"
fi
if [ "$target" = "all" ] || [ "$target" = "n1" ]; then
  run_target generate_n1_references.m "$N1_DIR"
fi
