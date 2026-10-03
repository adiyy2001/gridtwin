# 0023 Procedural 3D substation scene

Status: accepted

## Context

The 3D view has to show the same substation as the diagram, with the same equipment, state and selection, and it has to be testable without a GPU. There is no model file to load, and a data set of scanned equipment would bring a license to track.

## Decision

The scene is built from code with Three.js and has three layers.

- `scene-plan.ts` is a pure function from the substation description to a plan: boxes, cylinders, conductor segments, switch hinges and hit boxes, all in world units. It places busbars by row, bays by column and the equipment along each bay in electrical order. Nothing in it touches Three.js.
- `scene-state.ts` is a pure function from the store (switch positions, node conditions, branch and bus results, selection, hover) to colours, blade angles, label texts and one description per equipment. Selection maps the same way the diagram maps it.
- `scene-builders.ts` turns the plan into five instanced meshes (boxes, cylinders, porcelain, conductors including busbars, switch blades), a ground, a grid, invisible proxy boxes for picking, pooled selection brackets and label sprites. `scene-host.ts` owns the camera, the orbit controls, the lights, the environment map and the render loop.

The renderer is behind a small port (`RendererPort`) and the frame scheduler is injectable, so Vitest runs the host with a fake renderer and a manual scheduler. The real WebGL renderer and the canvas label texture are the only files excluded from coverage, and the Playwright visual suite covers them.

Rendering is on demand: a frame is requested when the state, the size or the camera changes, and while a blade is swinging. An idle scene draws nothing.

State is shown by colour and by a second cue that does not depend on colour: blue, grey and purple conductors for energized, de-energized and earthed, an angled blade for an open switch, a bracket for the selection, a red conductor and an exclamation mark in the label for an overload.

A click only selects, or asks the store for a switch operation, which waits for the same confirmation dialog as the diagram. A press that moves more than 5 px or lasts more than 700 ms is a camera drag and does nothing.

When WebGL is missing or the context cannot be created, the component shows a message and the rest of the application is unaffected.

The component is loaded with `@defer (on idle)`, which keeps Three.js out of the initial bundle (about 340 kB instead of 950 kB).

## Alternatives

Loading a glTF model would look better and would need an asset and a license. Drawing the scene by hand with raw WebGL would avoid a dependency and cost far more code. Rendering every frame is simpler and keeps a laptop fan busy for a static picture.

## Consequences

The plan and state logic are held to the logic coverage threshold. Geometry is simple by design: it is a teaching picture, not a survey.
