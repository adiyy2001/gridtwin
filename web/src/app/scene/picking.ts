import type { Intersection, Object3D } from 'three';

import { EQUIPMENT_ID_KEY } from './scene-builders';

export interface PointerRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface NormalizedPoint {
  readonly x: number;
  readonly y: number;
}

export const CLICK_MOVE_LIMIT_PX = 5;
export const CLICK_TIME_LIMIT_MS = 700;

export function toNormalizedPoint(
  clientX: number,
  clientY: number,
  rect: PointerRect,
): NormalizedPoint | null {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -(((clientY - rect.top) / rect.height) * 2 - 1),
  };
}

export function toCanvasPoint(
  point: NormalizedPoint,
  rect: PointerRect,
): { readonly x: number; readonly y: number } {
  return {
    x: ((point.x + 1) / 2) * rect.width,
    y: ((1 - point.y) / 2) * rect.height,
  };
}

export function equipmentIdOf(object: Object3D | null): string | null {
  let current: Object3D | null = object;
  while (current !== null) {
    const value: unknown = current.userData[EQUIPMENT_ID_KEY];
    if (typeof value === 'string') {
      return value;
    }
    current = current.parent;
  }
  return null;
}

export function firstEquipmentHit(intersections: readonly Intersection[]): string | null {
  const ordered = [...intersections].sort((a, b) => a.distance - b.distance);
  for (const hit of ordered) {
    const id = equipmentIdOf(hit.object);
    if (id !== null) {
      return id;
    }
  }
  return null;
}

export class ClickGesture {
  private startX = 0;
  private startY = 0;
  private startedAt = 0;
  private moved = false;
  private active = false;

  begin(x: number, y: number, at: number): void {
    this.startX = x;
    this.startY = y;
    this.startedAt = at;
    this.moved = false;
    this.active = true;
  }

  move(x: number, y: number): void {
    if (this.active && Math.hypot(x - this.startX, y - this.startY) > CLICK_MOVE_LIMIT_PX) {
      this.moved = true;
    }
  }

  finish(at: number): boolean {
    const click = this.active && !this.moved && at - this.startedAt <= CLICK_TIME_LIMIT_MS;
    this.active = false;
    return click;
  }

  cancel(): void {
    this.active = false;
  }
}
