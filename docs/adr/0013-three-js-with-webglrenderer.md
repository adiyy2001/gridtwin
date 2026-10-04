# 0013 Three.js with WebGLRenderer

Status: accepted

## Context

The 3D substation needs instanced meshes, physically based materials and shadows, and it has to be captured in screenshots on a machine without a guaranteed GPU. Three.js r186 (npm `three` 0.186.1, MIT, released 2026-09-24) ships both `WebGLRenderer` and a WebGPU renderer under `three/webgpu`.

Headless Google Chrome 148 on the development machine, started with `--use-angle=swiftshader --enable-unsafe-swiftshader`, creates a WebGL 2 context (renderer string "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device)...)"). WebGPU in headless Chrome without a GPU was not tried.

## Decision

Use `WebGLRenderer`. Materials are `MeshStandardMaterial`, with `MeshPhysicalMaterial` where a clear coat helps (porcelain insulators) and `MeshLambertMaterial` for the ground, which covers most of the screen and has no specular detail to lose. Lighting comes from a directional light with a soft shadow map that is rebuilt only when the content changes or a blade moves, and an environment map generated at runtime with `PMREMGenerator` from `RoomEnvironment`, so the scene needs no external assets. Repeated equipment (insulators, blades, bushings, gantry posts) uses `InstancedMesh`. The scene renders on demand: a frame is drawn when the camera moves, the state changes or an animation runs.

The scene builders are plain functions from the substation description to Three.js objects, so they run under Vitest without a renderer. A small host class owns the renderer, the canvas and the loop.

When WebGL is not available the 3D panel shows a message and the rest of the application keeps working.

## Alternatives

`WebGPURenderer` is the direction of the library. Nothing in the project needs it, it cannot be verified widely on this machine and it would make the screenshot job depend on a software adapter that may not exist in CI.

## Consequences

The 60 fps target is measured by `bench/web/fps.ts`, which also reports dropped frames, GPU time from timer queries and three controls that render nothing. On the Iris Xe behind the WSL2 Direct3D 12 layer the orbit runs at 46 to 52 fps, so the target is not met there. The README states which numbers came from where, and a native machine has to confirm the result.
