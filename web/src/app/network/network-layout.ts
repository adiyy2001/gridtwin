import type { CaseDetail } from '../model/api-types';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface BranchGeometry {
  readonly start: Point;
  readonly end: Point;
  readonly middle: Point;
  readonly labelAt: Point;
  readonly length: number;
}

export interface NetworkLayout {
  readonly positions: ReadonlyMap<number, Point>;
  readonly viewBox: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export const SPLIT_BUS_OFFSET: Point = { x: 38, y: 38 };
export const VIEW_PADDING = 70;
export const PARALLEL_SPACING = 12;
const LABEL_DISTANCE = 12;

function fallbackPosition(index: number, count: number): Point {
  const angle = (2 * Math.PI * index) / Math.max(count, 1);
  return { x: 400 + 300 * Math.cos(angle), y: 300 + 220 * Math.sin(angle) };
}

export function buildLayout(detail: CaseDetail): NetworkLayout {
  const positions = new Map<number, Point>();
  detail.buses.forEach((bus, index) => {
    const known = bus.x !== undefined && bus.x !== null && bus.y !== undefined && bus.y !== null;
    positions.set(
      bus.number,
      known ? { x: bus.x ?? 0, y: bus.y ?? 0 } : fallbackPosition(index, detail.buses.length),
    );
  });
  const substation = detail.substation;
  if (substation) {
    const host = positions.get(substation.bus);
    if (host !== undefined) {
      substation.busbars
        .filter((busbar) => busbar.bus !== substation.bus)
        .forEach((busbar, index) => {
          positions.set(busbar.bus, {
            x: host.x + SPLIT_BUS_OFFSET.x * (index + 1),
            y: host.y + SPLIT_BUS_OFFSET.y * (index + 1),
          });
        });
    }
  }
  const points = [...positions.values()];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - VIEW_PADDING;
  const minY = Math.min(...ys) - VIEW_PADDING;
  const maxX = Math.max(...xs) + VIEW_PADDING;
  const maxY = Math.max(...ys) + VIEW_PADDING;
  return {
    positions,
    viewBox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
  };
}

export function parallelIndexes(
  branches: readonly { readonly id: string; readonly from: number; readonly to: number }[],
): ReadonlyMap<string, number> {
  const seen = new Map<string, number>();
  const result = new Map<string, number>();
  for (const branch of branches) {
    const key = `${Math.min(branch.from, branch.to)}-${Math.max(branch.from, branch.to)}`;
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    result.set(branch.id, index);
  }
  return result;
}

export function branchGeometry(
  from: Point,
  to: Point,
  parallelIndex: number,
  labelSide: 1 | -1 = 1,
): BranchGeometry {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const normal = length === 0 ? { x: 0, y: 0 } : { x: -dy / length, y: dx / length };
  const shift = parallelIndex * PARALLEL_SPACING;
  const start = { x: from.x + normal.x * shift, y: from.y + normal.y * shift };
  const end = { x: to.x + normal.x * shift, y: to.y + normal.y * shift };
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const labelAt = {
    x: middle.x + normal.x * LABEL_DISTANCE * labelSide,
    y: middle.y + normal.y * LABEL_DISTANCE * labelSide,
  };
  return { start, end, middle, labelAt, length };
}
