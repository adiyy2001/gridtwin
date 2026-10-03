import type { Camera, Scene, Texture } from 'three';

export interface PixelFrame {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

export interface RendererPort {
  readonly canvas: HTMLCanvasElement;
  setSize(width: number, height: number, pixelRatio: number): void;
  render(scene: Scene, camera: Camera): void;
  readPixels(): PixelFrame | null;
  describeRenderer(): string;
  createEnvironment(): Texture | null;
  dispose(): void;
}
