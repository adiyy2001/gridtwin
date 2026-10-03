import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';

import type { Point } from './network-layout';
import { particlePositions } from './particles';
import type { FlowDirection } from './particles';

export interface ParticleFlow {
  readonly id: string;
  readonly start: Point;
  readonly end: Point;
  readonly direction: FlowDirection;
  readonly speed: number;
  readonly spacing: number;
  readonly colour: string;
}

export interface ViewBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CanvasTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export const PARTICLE_RADIUS = 3.2;

export function canvasTransform(viewBox: ViewBox, width: number, height: number): CanvasTransform {
  const scale = Math.min(width / viewBox.width, height / viewBox.height);
  return {
    scale,
    offsetX: (width - viewBox.width * scale) / 2 - viewBox.x * scale,
    offsetY: (height - viewBox.height * scale) / 2 - viewBox.y * scale,
  };
}

export function drawParticles(
  context: Pick<CanvasRenderingContext2D, 'beginPath' | 'arc' | 'fill' | 'fillStyle'>,
  flows: readonly ParticleFlow[],
  seconds: number,
  transform: CanvasTransform,
): number {
  let drawn = 0;
  for (const flow of flows) {
    const points = particlePositions(
      flow.start,
      flow.end,
      flow.direction,
      flow.speed,
      flow.spacing,
      seconds,
    );
    context.fillStyle = flow.colour;
    for (const point of points) {
      context.beginPath();
      context.arc(
        point.x * transform.scale + transform.offsetX,
        point.y * transform.scale + transform.offsetY,
        PARTICLE_RADIUS * Math.max(transform.scale, 0.6),
        0,
        2 * Math.PI,
      );
      context.fill();
      drawn += 1;
    }
  }
  return drawn;
}

@Component({
  selector: 'gt-particle-layer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas aria-hidden="true" [attr.data-particles]="particleTotal()"></canvas>`,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  `,
})
export class ParticleLayer {
  readonly flows = input.required<readonly ParticleFlow[]>();
  readonly viewBox = input.required<ViewBox>();

  protected readonly particleTotal = computed(() =>
    this.flows().reduce((sum, flow) => sum + (flow.direction === 0 ? 0 : 1), 0),
  );

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);
  private frameHandle: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private startedAt = 0;
  private reducedMotion = false;

  constructor() {
    afterNextRender(() => {
      this.reducedMotion =
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.startedAt = performance.now();
      if (typeof ResizeObserver === 'function') {
        this.resizeObserver = new ResizeObserver(() => {
          this.paint(0);
        });
        this.resizeObserver.observe(this.canvas().nativeElement);
      }
      this.schedule();
    });
    effect(() => {
      this.flows();
      this.viewBox();
      if (this.reducedMotion) {
        this.paint(0);
      }
    });
    this.destroyRef.onDestroy(() => {
      if (this.frameHandle !== null) {
        cancelAnimationFrame(this.frameHandle);
      }
      this.resizeObserver?.disconnect();
    });
  }

  private schedule(): void {
    if (this.reducedMotion) {
      this.paint(0);
      return;
    }
    this.frameHandle = requestAnimationFrame((now) => {
      this.paint((now - this.startedAt) / 1000);
      this.schedule();
    });
  }

  private paint(seconds: number): void {
    const element = this.canvas().nativeElement;
    const context = element.getContext('2d');
    if (context === null) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }
    if (
      element.width !== Math.round(width * ratio) ||
      element.height !== Math.round(height * ratio)
    ) {
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    drawParticles(context, this.flows(), seconds, canvasTransform(this.viewBox(), width, height));
  }
}
