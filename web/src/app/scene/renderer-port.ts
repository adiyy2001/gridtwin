import type { Camera, Scene, Texture } from 'three';

export interface PixelFrame {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

export interface RenderLoad {
  readonly drawCalls: number;
  readonly triangles: number;
}

export interface RendererPort {
  readonly canvas: HTMLCanvasElement;
  setSize(width: number, height: number, pixelRatio: number): void;
  render(scene: Scene, camera: Camera): void;
  refreshShadows(): void;
  readPixels(): PixelFrame | null;
  describeRenderer(): string;
  load(): RenderLoad;
  setGpuTiming(enabled: boolean): boolean;
  gpuTimes(): readonly number[];
  createEnvironment(): Texture | null;
  dispose(): void;
}
