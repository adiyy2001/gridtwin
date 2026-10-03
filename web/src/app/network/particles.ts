import type { BranchState } from '../model/api-types';
import type { Point } from './network-layout';

export type FlowDirection = 1 | -1 | 0;

export const MIN_FLOW_MW = 0.05;
export const BASE_SPEED = 16;
export const SPEED_PER_MW = 0.45;
export const MAX_SPEED = 110;
export const MIN_SPACING = 14;
export const MAX_SPACING = 44;
export const SPACING_REDUCTION = 30;

export function flowDirection(branch: BranchState): FlowDirection {
  if (!branch.inService || !branch.energized) {
    return 0;
  }
  if (Math.abs(branch.activeFromMw) < MIN_FLOW_MW) {
    return 0;
  }
  return branch.activeFromMw > 0 ? 1 : -1;
}

export function particleSpeed(activeMw: number): number {
  const magnitude = Math.abs(activeMw);
  if (magnitude < MIN_FLOW_MW) {
    return 0;
  }
  return Math.min(MAX_SPEED, BASE_SPEED + SPEED_PER_MW * magnitude);
}

export function particleSpacing(loading: number): number {
  const bounded = Math.min(1, Math.max(0, loading));
  return Math.min(MAX_SPACING, Math.max(MIN_SPACING, MAX_SPACING - SPACING_REDUCTION * bounded));
}

export function particleCount(length: number, spacing: number): number {
  if (length <= 0 || spacing <= 0) {
    return 0;
  }
  return Math.max(1, Math.floor(length / spacing));
}

export function particlePositions(
  start: Point,
  end: Point,
  direction: FlowDirection,
  speed: number,
  spacing: number,
  seconds: number,
): Point[] {
  if (direction === 0 || speed <= 0) {
    return [];
  }
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length === 0) {
    return [];
  }
  const count = particleCount(length, spacing);
  const travelled = (seconds * speed) % spacing;
  const ux = (end.x - start.x) / length;
  const uy = (end.y - start.y) / length;
  const positions: Point[] = [];
  for (let index = 0; index < count; index += 1) {
    const along = (travelled + index * spacing) % length;
    const distance = direction === 1 ? along : length - along;
    positions.push({ x: start.x + ux * distance, y: start.y + uy * distance });
  }
  return positions;
}
