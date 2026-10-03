import type { BranchGeometry, Point } from './network-layout';

interface Box {
  readonly x: number;
  readonly y: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
}

export interface LabelRequest {
  readonly id: string;
  readonly geometry: BranchGeometry;
  readonly characters: number;
}

const CHARACTER_WIDTH = 7.8;
const LABEL_HEIGHT = 22;
const LINE_CLEARANCE = 11;
const OFFSET = 12;
const FRACTIONS: readonly number[] = [0.5, 0.4, 0.6, 0.3, 0.7, 0.25, 0.75];
const SIDES: readonly (1 | -1)[] = [1, -1];

function busBoxes(position: Point): readonly Box[] {
  return [
    { x: position.x, y: position.y, halfWidth: 22, halfHeight: 22 },
    { x: position.x, y: position.y - 22, halfWidth: 32, halfHeight: 9 },
    { x: position.x, y: position.y + 34, halfWidth: 38, halfHeight: 9 },
  ];
}

function overlaps(first: Box, second: Box): boolean {
  return (
    Math.abs(first.x - second.x) < first.halfWidth + second.halfWidth &&
    Math.abs(first.y - second.y) < first.halfHeight + second.halfHeight
  );
}

function candidates(request: LabelRequest): readonly Point[] {
  const { start, end, length } = request.geometry;
  const normal =
    length === 0
      ? { x: 0, y: 0 }
      : { x: -(end.y - start.y) / length, y: (end.x - start.x) / length };
  const orientation = end.x - start.x >= 0 ? 1 : -1;
  return FRACTIONS.flatMap((fraction) =>
    SIDES.map((side) => ({
      x: start.x + (end.x - start.x) * fraction + normal.x * OFFSET * side * orientation,
      y: start.y + (end.y - start.y) * fraction + normal.y * OFFSET * side * orientation,
    })),
  );
}

function boxAt(point: Point, request: LabelRequest): Box {
  return {
    x: point.x,
    y: point.y,
    halfWidth: (request.characters * CHARACTER_WIDTH) / 2,
    halfHeight: LABEL_HEIGHT / 2,
  };
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const squaredLength = dx * dx + dy * dy;
  const along =
    squaredLength === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / squaredLength),
        );
  return Math.hypot(point.x - (start.x + along * dx), point.y - (start.y + along * dy));
}

function collisions(
  box: Box,
  occupied: readonly Box[],
  foreignLines: readonly BranchGeometry[],
): number {
  const crossedLines = foreignLines.filter(
    (line) => distanceToSegment(box, line.start, line.end) < LINE_CLEARANCE,
  );
  return occupied.filter((other) => overlaps(box, other)).length + crossedLines.length;
}

export function placeLabels(
  requests: readonly LabelRequest[],
  busPositions: readonly Point[],
): ReadonlyMap<string, Point> {
  const placed: Box[] = busPositions.flatMap(busBoxes);
  const result = new Map<string, Point>();
  for (const request of requests) {
    const foreignLines = requests
      .filter((other) => other.id !== request.id)
      .map((other) => other.geometry);
    const scored = candidates(request).map((point) => {
      const box = boxAt(point, request);
      return { point, box, collisions: collisions(box, placed, foreignLines) };
    });
    const best = scored.reduce((winner, entry) =>
      entry.collisions < winner.collisions ? entry : winner,
    );
    placed.push(best.box);
    result.set(request.id, best.point);
  }
  return result;
}
