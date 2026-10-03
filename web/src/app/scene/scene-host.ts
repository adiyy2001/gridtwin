import {
  Color,
  DirectionalLight,
  Fog,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
} from 'three';
import type { Texture } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { firstEquipmentHit, toCanvasPoint, toNormalizedPoint } from './picking';
import type { RendererPort } from './renderer-port';
import type { SceneContents } from './scene-builders';
import { planCenter } from './scene-plan';
import type { ScenePlan } from './scene-plan';
import type { SceneState } from './scene-state';

export interface FrameScheduler {
  request(callback: (time: number) => void): number;
  cancel(handle: number): void;
}

export interface FrameStats {
  readonly width: number;
  readonly height: number;
  readonly nonBackgroundRatio: number;
  readonly hash: string;
  readonly renderer: string;
}

export interface FrameMeasurement {
  readonly width: number;
  readonly height: number;
  readonly frames: number;
  readonly durationMs: number;
  readonly averageFps: number;
  readonly medianFrameMs: number;
  readonly p95FrameMs: number;
  readonly renderer: string;
}

export interface MeasureOptions {
  readonly width?: number;
  readonly height?: number;
  readonly durationMs?: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
  readonly clientX: number;
  readonly clientY: number;
}

export interface SceneHostOptions {
  readonly renderer: RendererPort;
  readonly contents: SceneContents;
  readonly plan: ScenePlan;
  readonly environment: Texture | null;
  readonly scheduler: FrameScheduler;
}

export const BACKGROUND = 0xc9d3de;
const FRAME_LIMIT_MS = 100;
const FOCUS_OFFSET = new Vector3(12, 9, 17);
const DEFAULT_MEASURE_MS = 3000;
const MEASURE_WIDTH = 1920;
const MEASURE_HEIGHT = 1080;
const BACKGROUND_TOLERANCE = 12;
const HASH_STRIDE = 7;
const FNV_PRIME = 16777619;

export const browserScheduler: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => {
    cancelAnimationFrame(handle);
  },
};

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index] ?? 0;
}

export class SceneHost {
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  private readonly scene = new Scene();
  private readonly raycaster = new Raycaster();
  private readonly center: Vector3;
  private readonly homePosition: Vector3;
  private readonly topPosition: Vector3;
  private frameHandle: number | null = null;
  private lastTime: number | null = null;
  private state: SceneState | null = null;
  private disposed = false;
  private measuring = false;
  private cssWidth = 0;
  private cssHeight = 0;
  private pixelRatio = 1;

  constructor(private readonly options: SceneHostOptions) {
    const { contents, plan, renderer, environment } = options;
    const target = planCenter(plan);
    this.center = new Vector3(target.x, 2.5, target.z + 5);
    this.homePosition = new Vector3(target.x + 10, 46, plan.bounds.max.z + 46);
    this.topPosition = new Vector3(target.x + 0.01, 120, target.z + 8);
    this.camera = new PerspectiveCamera(40, 16 / 9, 1, 600);
    this.scene.background = new Color(BACKGROUND);
    this.scene.fog = new Fog(BACKGROUND, 150, 420);
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.75;
    this.scene.add(contents.root);
    this.addLight(target.x, target.z);
    this.controls = new OrbitControls(this.camera, renderer.canvas);
    this.controls.enableDamping = false;
    this.controls.target.copy(this.center);
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 220;
    this.controls.keyPanSpeed = 14;
    this.controls.listenToKeyEvents(renderer.canvas);
    this.controls.addEventListener('change', () => {
      this.requestRender();
    });
    this.resetView();
  }

  get contents(): SceneContents {
    return this.options.contents;
  }

  get currentState(): SceneState | null {
    return this.state;
  }

  setState(state: SceneState): void {
    this.state = state;
    this.options.contents.apply(state);
    this.requestRender();
  }

  resize(width: number, height: number, pixelRatio: number): void {
    if (width <= 0 || height <= 0 || this.measuring) {
      return;
    }
    this.cssWidth = width;
    this.cssHeight = height;
    this.pixelRatio = pixelRatio;
    this.options.renderer.setSize(width, height, pixelRatio);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  resetView(): void {
    this.placeCamera(this.homePosition);
  }

  focusOn(id: string): boolean {
    const center = this.options.contents.centerOf(id);
    if (center === null) {
      return false;
    }
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(FOCUS_OFFSET);
    this.camera.lookAt(center);
    this.controls.update();
    this.requestRender();
    return true;
  }

  topView(): void {
    this.placeCamera(this.topPosition);
  }

  requestRender(): void {
    if (this.frameHandle !== null || this.disposed) {
      return;
    }
    this.frameHandle = this.options.scheduler.request((time) => {
      this.frame(time);
    });
  }

  pick(clientX: number, clientY: number): string | null {
    const rect = this.options.renderer.canvas.getBoundingClientRect();
    const point = toNormalizedPoint(clientX, clientY, rect);
    if (point === null) {
      return null;
    }
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(new Vector2(point.x, point.y), this.camera);
    const hits = this.raycaster.intersectObjects(this.options.contents.proxies.children, false);
    return firstEquipmentHit(hits);
  }

  screenPointOf(id: string): ScreenPoint | null {
    const center = this.options.contents.centerOf(id);
    if (center === null) {
      return null;
    }
    this.camera.updateMatrixWorld();
    const projected = center.project(this.camera);
    const rect = this.options.renderer.canvas.getBoundingClientRect();
    const local = toCanvasPoint({ x: projected.x, y: projected.y }, rect);
    return { ...local, clientX: rect.left + local.x, clientY: rect.top + local.y };
  }

  frameStats(): FrameStats | null {
    const root = this.options.contents.root;
    root.visible = false;
    this.renderNow(0);
    const empty = this.options.renderer.readPixels();
    root.visible = true;
    this.renderNow(0);
    const frame = this.options.renderer.readPixels();
    if (frame?.data.length !== empty?.data.length || frame === null || empty === null) {
      return null;
    }
    const pixels = frame.width * frame.height;
    let different = 0;
    let hash = 2166136261;
    for (let index = 0; index < pixels; index += 1) {
      const offset = index * 4;
      const distance =
        Math.abs((frame.data[offset] ?? 0) - (empty.data[offset] ?? 0)) +
        Math.abs((frame.data[offset + 1] ?? 0) - (empty.data[offset + 1] ?? 0)) +
        Math.abs((frame.data[offset + 2] ?? 0) - (empty.data[offset + 2] ?? 0));
      if (distance > BACKGROUND_TOLERANCE) {
        different += 1;
      }
      if (index % HASH_STRIDE === 0) {
        hash = Math.imul(hash ^ ((frame.data[offset] ?? 0) >> 3), FNV_PRIME);
        hash = Math.imul(hash ^ ((frame.data[offset + 1] ?? 0) >> 3), FNV_PRIME);
        hash = Math.imul(hash ^ ((frame.data[offset + 2] ?? 0) >> 3), FNV_PRIME);
      }
    }
    return {
      width: frame.width,
      height: frame.height,
      nonBackgroundRatio: pixels === 0 ? 0 : different / pixels,
      hash: (hash >>> 0).toString(16),
      renderer: this.options.renderer.describeRenderer(),
    };
  }

  measureFrames(options: MeasureOptions = {}): Promise<FrameMeasurement> {
    const width = options.width ?? MEASURE_WIDTH;
    const height = options.height ?? MEASURE_HEIGHT;
    const durationMs = options.durationMs ?? DEFAULT_MEASURE_MS;
    this.measuring = true;
    this.options.renderer.setSize(width, height, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const home = this.camera.position.clone();
    const intervals: number[] = [];
    return new Promise((resolve) => {
      let previous: number | null = null;
      let started: number | null = null;
      const step = (time: number): void => {
        started ??= time;
        if (previous !== null) {
          intervals.push(time - previous);
        }
        previous = time;
        const elapsed = time - started;
        this.camera.position
          .sub(this.center)
          .applyAxisAngle(new Vector3(0, 1, 0), 0.01)
          .add(this.center);
        this.camera.lookAt(this.center);
        this.options.renderer.render(this.scene, this.camera);
        if (elapsed < durationMs) {
          this.options.scheduler.request(step);
          return;
        }
        this.measuring = false;
        this.camera.position.copy(home);
        this.resize(this.cssWidth, this.cssHeight, this.pixelRatio);
        const sorted = [...intervals].sort((a, b) => a - b);
        const total = intervals.reduce((sum, value) => sum + value, 0);
        resolve({
          width,
          height,
          frames: intervals.length,
          durationMs: total,
          averageFps: total === 0 ? 0 : (intervals.length / total) * 1000,
          medianFrameMs: percentile(sorted, 0.5),
          p95FrameMs: percentile(sorted, 0.95),
          renderer: this.options.renderer.describeRenderer(),
        });
      };
      this.options.scheduler.request(step);
    });
  }

  dispose(): void {
    this.disposed = true;
    if (this.frameHandle !== null) {
      this.options.scheduler.cancel(this.frameHandle);
      this.frameHandle = null;
    }
    this.controls.dispose();
    this.options.contents.dispose();
    this.options.environment?.dispose();
    this.options.renderer.dispose();
  }

  private placeCamera(position: Vector3): void {
    this.camera.position.copy(position);
    this.controls.target.copy(this.center);
    this.camera.lookAt(this.center);
    this.controls.update();
    this.requestRender();
  }

  private addLight(centerX: number, centerZ: number): void {
    const sun = new DirectionalLight(0xfff1de, 2.6);
    sun.position.set(centerX - 40, 70, centerZ + 55);
    sun.target.position.set(centerX, 0, centerZ);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 55;
    sun.shadow.camera.bottom = -55;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 220;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.06;
    this.scene.add(sun);
    this.scene.add(sun.target);
  }

  private renderNow(delta: number): boolean {
    const animating = this.options.contents.advance(delta);
    this.controls.update();
    this.options.contents.fadeLabels(this.camera.position);
    this.options.renderer.render(this.scene, this.camera);
    return animating;
  }

  private frame(time: number): void {
    this.frameHandle = null;
    const delta = this.lastTime === null ? 16 : Math.min(time - this.lastTime, FRAME_LIMIT_MS);
    this.lastTime = time;
    const animating = this.renderNow(delta);
    if (animating) {
      this.requestRender();
    } else {
      this.lastTime = null;
    }
  }
}
