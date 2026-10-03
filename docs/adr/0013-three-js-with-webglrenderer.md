# 0013 Three.js with WebGLRenderer

Status: accepted

## Context

The 3D substation needs instanced meshes, physically based materials and shadows, and it has to be captured in screenshots on a machine without a guaranteed GPU. Three.js r186 (npm `three` 0.186.1, MIT, released 2026-09-24) ships both `WebGLRenderer` and a WebGPU renderer under `three/webgpu`.

Headless Google Chrome 148 on the development machine, started with `--use-angle=swiftshader --enable-unsafe-swiftshader`, creates a WebGL 2 context (renderer string "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device)...)"). WebGPU in headless Chrome without a GPU was not tried.

## Decision

Use `WebGLRenderer`. Materials are `MeshStandardMaterial`, with `MeshPhysicalMaterial` where a clear coat helps (porcelain insulators). Lighting comes from a directional light with a soft shadow map and an environment map generated at runtime with `PMREMGenerator` from `RoomEnvironment`, so the scene needs no external assets. Repeated equipment (insulators, blades, bushings, gantry posts) uses `InstancedMesh`. The scene renders on demand: a frame is drawn when the camera moves, the state changes or an animation runs.

The scene builders are plain functions from the substation description to Three.js objects, so they run under Vitest without a renderer. A small host class owns the renderer, the canvas and the loop.

When WebGL is not available the 3D panel shows a message and the rest of the application keeps working.

## Alternatives

`WebGPURenderer` is the direction of the library. Nothing in the project needs it, it cannot be verified widely on this machine and it would make the screenshot job depend on a software adapter that may not exist in CI.

## Consequences

Frame rates measured here come from a software renderer and say nothing about an integrated GPU. The 60 fps target is measured by `bench/web/fps.ts` on a machine with a real GPU, and the README states which numbers came from where.
