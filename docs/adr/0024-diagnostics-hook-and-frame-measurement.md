# 0024 Diagnostics hook and frame measurement

Status: accepted

## Context

The end-to-end, visual and benchmark scripts need to read what the 3D scene shows without reading pixels by guesswork, and the benchmarks need numbers from inside the page.

## Decision

The page exposes `window.__gridtwin`. It holds `latencies`, one entry per confirmed switch command, in milliseconds from the start of `confirmPending` to the second animation frame after the new state is applied. Under `scene` it exposes `describe()` (WebGL flag, animation flag, one entry per equipment with position, condition, selection and hover), `screenPointOf(id)` (the client position of a piece of equipment, so a test clicks where the equipment really is), `focusOn(id)`, `frameStats()` and `measureFrames(options)`.

`frameStats()` renders the scene with and without its content and counts the pixels that differ. This is independent of tone mapping and fog, so the "not blank" check does not depend on a colour constant. `measureFrames()` orbits the camera at a fixed size for a fixed time and reports the frame intervals.

The hook is always on. It carries no data that the page does not already show, and a hook that only exists in test builds would test a different application from the one that ships.

## Alternatives

Reading screenshots only would make the Cypress scenario depend on pixel positions. A test-only build flag would need a second build and a second set of results.

## Consequences

The command latency includes the redraw of the 3D scene, so on a machine with software WebGL it is dominated by rendering. The benchmark reports it with and without the 3D scene, together with the renderer string.
