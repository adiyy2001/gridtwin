import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import type { ElementRef } from '@angular/core';

import { Diagnostics } from '../core/diagnostics';
import { TwinStore } from '../core/twin-store';
import { ClickGesture } from './picking';
import { buildSceneContents } from './scene-builders';
import { SCENE_ENVIRONMENT } from './scene-environment';
import { SceneHost } from './scene-host';
import type { FrameMeasurement, FrameStats, MeasureOptions, ScreenPoint } from './scene-host';
import { buildScenePlan } from './scene-plan';
import { buildSceneState, describeEquipment } from './scene-state';
import type { EquipmentDescription } from './scene-state';

export interface SceneDiagnostics {
  describe(): { webgl: boolean; animating: boolean; items: EquipmentDescription[] };
  screenPointOf(id: string): ScreenPoint | null;
  focusOn(id: string): boolean;
  frameStats(): FrameStats | null;
  measureFrames(options?: MeasureOptions): Promise<FrameMeasurement>;
}

const HINT = 'Hover equipment to read it here. Click a switch to operate it after confirming.';

@Component({
  selector: 'gt-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scene-view.html',
  styleUrl: './scene-view.css',
})
export class SceneView {
  protected readonly store = inject(TwinStore);
  private readonly diagnostics = inject(Diagnostics);
  private readonly environment = inject(SCENE_ENVIRONMENT);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = signal<SceneHost | null>(null);
  private readonly gesture = new ClickGesture();
  protected readonly unavailable = signal(false);

  private readonly substation = computed(() => this.store.caseDetail()?.substation ?? null);

  private readonly plan = computed(() => {
    const substation = this.substation();
    const detail = this.store.caseDetail();
    if (substation === null || detail === null) {
      return null;
    }
    const transformers = new Set(detail.branches.filter((b) => b.transformer).map((b) => b.id));
    return buildScenePlan(substation, transformers);
  });

  private readonly operable = computed(
    () => this.store.isLive() && !this.store.busy() && this.store.pending() === null,
  );

  protected readonly sceneState = computed(() => {
    const plan = this.plan();
    const substation = this.substation();
    if (plan === null || substation === null || this.store.state() === null) {
      return null;
    }
    return buildSceneState({
      plan,
      substation,
      nodeStates: this.store.nodeConditions(),
      positions: this.store.shownSwitchPositions(),
      branches: this.store.branchesById(),
      buses: this.store.busesByNumber(),
      selection: this.store.selection(),
      hover: this.store.hover(),
      operable: this.operable(),
    });
  });

  protected readonly readout = computed(() => {
    const state = this.sceneState();
    if (state === null) {
      return HINT;
    }
    const entries = [...state.equipment.values()];
    const shown = entries.find((entry) => entry.hovered) ?? entries.find((entry) => entry.selected);
    return shown?.description ?? HINT;
  });

  protected readonly focusTarget = computed(() => {
    const entries = [...(this.sceneState()?.equipment.values() ?? [])].filter(
      (entry) => entry.selected,
    );
    return (entries.find((entry) => entry.kind === 'switch') ?? entries[0])?.id ?? null;
  });

  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      const plan = this.plan();
      const element = this.canvas().nativeElement;
      if (plan !== null) {
        untracked(() => {
          this.mount(plan, element);
        });
      }
    });
    effect(() => {
      const state = this.sceneState();
      const host = this.host();
      if (state !== null && host !== null) {
        host.setState(state);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.unmount();
    });
  }

  protected resetView(): void {
    this.host()?.resetView();
  }

  protected topView(): void {
    this.host()?.topView();
  }

  protected focusSelection(): void {
    const target = this.focusTarget();
    if (target !== null) {
      this.host()?.focusOn(target);
    }
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button === 0) {
      this.gesture.begin(event.clientX, event.clientY, event.timeStamp);
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    this.gesture.move(event.clientX, event.clientY);
    const host = this.host();
    if (host === null || event.buttons !== 0) {
      return;
    }
    this.store.setHover(this.selectionAt(host, event.clientX, event.clientY));
  }

  protected onPointerUp(event: PointerEvent): void {
    const host = this.host();
    if (host === null || !this.gesture.finish(event.timeStamp)) {
      return;
    }
    const id = host.pick(event.clientX, event.clientY);
    const entry = id === null ? undefined : this.sceneState()?.equipment.get(id);
    if (entry === undefined) {
      return;
    }
    this.store.select(entry.selection);
    if (entry.switchId !== null && entry.targetPosition !== null && this.operable()) {
      this.store.requestSwitch(entry.switchId, entry.targetPosition);
    }
  }

  protected onPointerLeave(): void {
    this.gesture.cancel();
    this.store.setHover(null);
  }

  private selectionAt(host: SceneHost, clientX: number, clientY: number) {
    const id = host.pick(clientX, clientY);
    const entry = id === null ? undefined : this.sceneState()?.equipment.get(id);
    this.canvas().nativeElement.classList.toggle('over-equipment', entry !== undefined);
    return entry?.selection ?? null;
  }

  private mount(
    plan: NonNullable<ReturnType<SceneView['plan']>>,
    element: HTMLCanvasElement,
  ): void {
    this.unmount();
    if (!this.environment.available()) {
      this.unavailable.set(true);
      this.diagnostics.expose('scene', this.diagnosticsApi(null));
      return;
    }
    try {
      const renderer = this.environment.createRenderer(element);
      const contents = buildSceneContents(plan, this.environment.createLabels());
      const host = new SceneHost({
        renderer,
        contents,
        plan,
        environment: renderer.createEnvironment(),
        scheduler: this.environment.scheduler,
      });
      this.unavailable.set(false);
      this.observeSize(host, element);
      this.host.set(host);
      this.diagnostics.expose('scene', this.diagnosticsApi(host));
    } catch {
      this.unavailable.set(true);
      this.diagnostics.expose('scene', this.diagnosticsApi(null));
    }
  }

  private observeSize(host: SceneHost, element: HTMLCanvasElement): void {
    const apply = (): void => {
      const rect = element.getBoundingClientRect();
      host.resize(
        Math.floor(rect.width),
        Math.floor(rect.height),
        Math.min(window.devicePixelRatio, 2),
      );
    };
    apply();
    this.resizeObserver = new ResizeObserver(apply);
    this.resizeObserver.observe(element);
  }

  private unmount(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.host()?.dispose();
    this.host.set(null);
    this.diagnostics.withdraw('scene');
  }

  private diagnosticsApi(host: SceneHost | null): SceneDiagnostics {
    const emptyMeasurement = (): Promise<FrameMeasurement> =>
      Promise.reject(new Error('the 3D view is not available'));
    return {
      describe: () => ({
        webgl: host !== null,
        animating: host?.contents.isAnimating() ?? false,
        items: describeEquipment(host?.currentState ?? null),
      }),
      screenPointOf: (id) => host?.screenPointOf(id) ?? null,
      focusOn: (id) => host?.focusOn(id) ?? false,
      frameStats: () => host?.frameStats() ?? null,
      measureFrames: (options) => host?.measureFrames(options) ?? emptyMeasurement(),
    };
  }
}
