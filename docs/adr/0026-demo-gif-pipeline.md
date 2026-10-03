# 0026 Demo GIF pipeline

Status: accepted

## Context

The README opens with a short recording of the application in use. The GIF has to stay under 8 MB and is recorded with Playwright and converted with ffmpeg. The recording has to show something worth watching: a closed coupler, the same coupler opened, a line going red, a breaker operated in the 3D view, the N-1 table and the cascade replay. It also has to be repeatable, so that a change in the interface does not leave a stale GIF behind.

## Decision

- `e2e/demo/run.ts` drives the real application with Playwright against the packaged jar and records a video. The story is a script, so it is re-recorded with one command (`pnpm --dir e2e run demo`).
- The recording uses the same software renderer as the visual suite. A first recording on the WSL GPU path (`GRIDTWIN_DEMO_GPU=1`) had torn and mixed frames in the video, so it stays an option and is not what the README shows.
- `tools/make-demo-gif.sh` converts the video with ffmpeg in two passes (a palette from the whole clip, then the GIF using it). Defaults are 6 frames per second, 900 px wide, 64 colours, and the first 4 seconds are cut. The script fails when the file is 8 MB or larger, and prints how to lower the three settings.
- The committed file is `docs/media/demo.gif`. It is 5.3 MB.

## Alternatives

A screen recorder gives uneven timing and cannot be repeated. A video file in the README would not play inline on GitHub in every viewer. APNG or WebP are smaller but are not shown everywhere a README is shown.

## Consequences

The GIF is a binary file in the history, and every re-recording adds another few megabytes, so it should be replaced rarely. At 6 frames per second the 3D motion looks coarse, which is the price of staying under the limit with 64 colours.
