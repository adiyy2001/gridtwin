import {
  ACESFilmicToneMapping,
  PCFShadowMap,
  PMREMGenerator,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import type { Camera, Scene, Texture } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import type { PixelFrame, RenderLoad, RendererPort } from './renderer-port';

interface TimerExtension {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
}

function isTimerExtension(value: unknown): value is TimerExtension {
  return typeof value === 'object' && value !== null && 'TIME_ELAPSED_EXT' in value;
}

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
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = PCFShadowMap;

  const gpuSamples: number[] = [];
  const pendingQueries: WebGLQuery[] = [];
  let timer: { gl: WebGL2RenderingContext; extension: TimerExtension } | null = null;

  function collectFinishedQueries(active: NonNullable<typeof timer>): void {
    const { gl, extension } = active;
    const first = pendingQueries[0];
    if (first === undefined || gl.getQueryParameter(first, gl.QUERY_RESULT_AVAILABLE) !== true) {
      return;
    }
    const disjoint = gl.getParameter(extension.GPU_DISJOINT_EXT) === true;
    const nanoseconds: unknown = gl.getQueryParameter(first, gl.QUERY_RESULT);
    if (!disjoint && typeof nanoseconds === 'number') {
      gpuSamples.push(nanoseconds / 1e6);
    }
    gl.deleteQuery(first);
    pendingQueries.shift();
  }

  return {
    canvas,
    setSize(width: number, height: number, pixelRatio: number): void {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
    },
    refreshShadows(): void {
      renderer.shadowMap.needsUpdate = true;
    },
    render(scene: Scene, camera: Camera): void {
      if (timer === null) {
        renderer.render(scene, camera);
        return;
      }
      const { gl, extension } = timer;
      const query = gl.createQuery();
      gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
      renderer.render(scene, camera);
      gl.endQuery(extension.TIME_ELAPSED_EXT);
      pendingQueries.push(query);
      collectFinishedQueries(timer);
    },
    setGpuTiming(enabled: boolean): boolean {
      gpuSamples.length = 0;
      pendingQueries.length = 0;
      const gl = renderer.getContext();
      const extension: unknown = enabled
        ? gl.getExtension('EXT_disjoint_timer_query_webgl2')
        : null;
      timer =
        enabled && gl instanceof WebGL2RenderingContext && isTimerExtension(extension)
          ? { gl, extension }
          : null;
      return !enabled || timer !== null;
    },
    gpuTimes(): readonly number[] {
      return gpuSamples;
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
    load(): RenderLoad {
      return { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
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
