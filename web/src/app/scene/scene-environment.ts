import { InjectionToken } from '@angular/core';

import { createCanvasLabelFactory } from './label-texture';
import type { RendererPort } from './renderer-port';
import type { LabelFactory } from './scene-builders';
import { browserScheduler } from './scene-host';
import type { FrameScheduler } from './scene-host';
import { createWebglRenderer, webglAvailable } from './webgl-renderer';

export interface SceneEnvironment {
  available(): boolean;
  createRenderer(canvas: HTMLCanvasElement): RendererPort;
  createLabels(): LabelFactory;
  readonly scheduler: FrameScheduler;
}

export const SCENE_ENVIRONMENT = new InjectionToken<SceneEnvironment>('SCENE_ENVIRONMENT', {
  providedIn: 'root',
  factory: () => ({
    available: webglAvailable,
    createRenderer: createWebglRenderer,
    createLabels: createCanvasLabelFactory,
    scheduler: browserScheduler,
  }),
});
