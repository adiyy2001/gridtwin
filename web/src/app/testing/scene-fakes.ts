import { Texture } from 'three';
import type { Camera, Scene } from 'three';

import type { PixelFrame, RendererPort } from '../scene/renderer-port';
import type { LabelFactory, LabelTexture } from '../scene/scene-builders';
import type { FrameScheduler } from '../scene/scene-host';
import type { LabelTone } from '../scene/scene-state';

export class ManualScheduler implements FrameScheduler {
  private nextHandle = 1;
  private readonly callbacks = new Map<number, (time: number) => void>();
  private clock = 0;

  get pending(): number {
    return this.callbacks.size;
  }

  request(callback: (time: number) => void): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  tick(stepMs = 16): boolean {
    const due = [...this.callbacks.entries()];
    this.callbacks.clear();
    this.clock += stepMs;
    due.forEach(([, callback]) => {
      callback(this.clock);
    });
    return due.length > 0;
  }

  run(limit = 200, stepMs = 16): number {
    let ticks = 0;
    while (ticks < limit && this.tick(stepMs)) {
      ticks += 1;
    }
    return ticks;
  }
}

export class FakeRenderer implements RendererPort {
  readonly canvas: HTMLCanvasElement;
  renders = 0;
  sizes: { width: number; height: number; pixelRatio: number }[] = [];
  disposed = false;
  frames: PixelFrame[] = [];
  environmentCreated = 0;

  constructor(canvas: HTMLCanvasElement = document.createElement('canvas')) {
    this.canvas = canvas;
    this.canvas.getBoundingClientRect = () => new DOMRect(10, 20, 800, 450);
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.sizes.push({ width, height, pixelRatio });
  }

  render(scene: Scene, camera: Camera): void {
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    this.renders += 1;
  }

  readPixels(): PixelFrame | null {
    return this.frames.shift() ?? null;
  }

  describeRenderer(): string {
    return 'fake renderer';
  }

  createEnvironment(): Texture | null {
    this.environmentCreated += 1;
    return null;
  }

  dispose(): void {
    this.disposed = true;
  }
}

export class StubLabels implements LabelFactory {
  readonly requests: { lines: readonly string[]; tone: LabelTone }[] = [];

  create(lines: readonly string[], tone: LabelTone): LabelTexture {
    this.requests.push({ lines, tone });
    return { texture: new Texture(), aspect: 3 };
  }
}
