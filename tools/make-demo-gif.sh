#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${1:-$ROOT/e2e/demo/out/demo.webm}"
TARGET="${2:-$ROOT/docs/media/demo.gif}"
START_SECONDS="${DEMO_GIF_START:-4}"
FRAMES_PER_SECOND="${DEMO_GIF_FPS:-6}"
WIDTH="${DEMO_GIF_WIDTH:-900}"
COLORS="${DEMO_GIF_COLORS:-64}"
LIMIT_BYTES=$((8 * 1024 * 1024))

command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }
[ -f "$SOURCE" ] || { echo "missing $SOURCE, run: pnpm --dir e2e run demo" >&2; exit 1; }

mkdir -p "$(dirname "$TARGET")"
PALETTE="$(mktemp --suffix=.png)"
trap 'rm -f "$PALETTE"' EXIT

FILTERS="fps=${FRAMES_PER_SECOND},scale=${WIDTH}:-1:flags=lanczos"
ffmpeg -v error -y -ss "$START_SECONDS" -i "$SOURCE" -vf "${FILTERS},palettegen=max_colors=${COLORS}:stats_mode=diff" "$PALETTE"
ffmpeg -v error -y -ss "$START_SECONDS" -i "$SOURCE" -i "$PALETTE" \
  -lavfi "${FILTERS}[frames];[frames][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  -loop 0 "$TARGET"

SIZE="$(stat -c %s "$TARGET")"
echo "wrote $TARGET, $SIZE bytes"
if [ "$SIZE" -ge "$LIMIT_BYTES" ]; then
  echo "the GIF is larger than 8 MB, lower DEMO_GIF_FPS, DEMO_GIF_WIDTH or DEMO_GIF_COLORS" >&2
  exit 1
fi
