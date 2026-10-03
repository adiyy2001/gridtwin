import {
  ACESFilmicToneMapping,
  PCFShadowMap,
  PMREMGenerator,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import type { Camera, Scene, Texture } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import type { PixelFrame, RendererPort } from './renderer-port';

export function webglAvailable(): boolean {
  try {
    const probe = document.createElement('canvas');
    return probe.getContext('webgl2') !== null || probe.getContext('webgl') !== null;
  } catch {
    return false;
  }
}

export function createWebglRenderer(canvas: HTMLCanvasElement): RendererPort {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  return {
    canvas,
    setSize(width: number, height: number, pixelRatio: number): void {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
    },
    render(scene: Scene, camera: Camera): void {
      renderer.render(scene, camera);
    },
    readPixels(): PixelFrame | null {
      const gl = renderer.getContext();
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const data = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return { width, height, data };
    },
    describeRenderer(): string {
      const gl = renderer.getContext();
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      const text: unknown =
        info === null
          ? gl.getParameter(gl.RENDERER)
          : gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
      return typeof text === 'string' ? text : 'unknown renderer';
    },
    createEnvironment(): Texture | null {
      const generator = new PMREMGenerator(renderer);
      const target = generator.fromScene(new RoomEnvironment(), 0.04);
      generator.dispose();
      return target.texture;
    },
    dispose(): void {
      renderer.dispose();
    },
  };
}
