export interface NavItem {
  readonly id: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly links?: readonly string[];
}

export type NavKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

export interface NavPoint {
  readonly x: number;
  readonly y: number;
}

const CROSS_AXIS_WEIGHT = 3;
const WIDE_ITEM = 200;
const NAV_KEYS: readonly string[] = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
];

export function isNavKey(key: string): key is NavKey {
  return NAV_KEYS.includes(key);
}

function centre(item: NavItem): NavPoint {
  return { x: (item.x1 + item.x2) / 2, y: (item.y1 + item.y2) / 2 };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export function anchorFor(item: NavItem, previous: NavPoint | null): NavPoint {
  const middle = centre(item);
  if (item.x2 - item.x1 < WIDE_ITEM) {
    return middle;
  }
  return { x: previous === null ? item.x1 : clamp(previous.x, item.x1, item.x2), y: middle.y };
}

function gap(value: number, low: number, high: number): number {
  if (value < low) {
    return low - value;
  }
  return value > high ? value - high : 0;
}

function readingOrder(items: readonly NavItem[]): NavItem[] {
  return [...items].sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1 || a.id.localeCompare(b.id));
}

function distanceInDirection(from: NavPoint, item: NavItem, key: NavKey): number | null {
  const centreOfItem = centre(item);
  const sameRowOrColumn =
    key === 'ArrowUp' || key === 'ArrowDown'
      ? gap(from.x, item.x1, item.x2)
      : gap(from.y, item.y1, item.y2);
  const along = {
    ArrowUp: from.y - centreOfItem.y,
    ArrowDown: centreOfItem.y - from.y,
    ArrowLeft: from.x - centreOfItem.x,
    ArrowRight: centreOfItem.x - from.x,
  }[key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'];
  return along > 1 ? along + CROSS_AXIS_WEIGHT * sameRowOrColumn : null;
}

function nextAlongBusbar(
  items: readonly NavItem[],
  current: NavItem,
  key: NavKey,
  from: NavPoint,
): string | null {
  const linked = (current.links ?? [])
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is NavItem => item !== undefined)
    .map((item) => ({ id: item.id, x: centre(item).x }));
  const candidates = {
    ArrowLeft: linked.filter((entry) => entry.x < from.x - 1).sort((a, b) => b.x - a.x),
    ArrowRight: linked.filter((entry) => entry.x > from.x + 1).sort((a, b) => a.x - b.x),
    ArrowDown: [...linked].sort(
      (a, b) => Math.abs(a.x - from.x) - Math.abs(b.x - from.x) || a.x - b.x,
    ),
  }[key as 'ArrowLeft' | 'ArrowRight' | 'ArrowDown'];
  return candidates[0]?.id ?? null;
}

export function nextItem(
  items: readonly NavItem[],
  currentId: string | null,
  key: NavKey,
  anchor: NavPoint | null,
): string | null {
  const ordered = readingOrder(items);
  if (ordered.length === 0) {
    return null;
  }
  if (key === 'Home') {
    return ordered[0]?.id ?? null;
  }
  if (key === 'End') {
    return ordered.at(-1)?.id ?? null;
  }
  const current = ordered.find((item) => item.id === currentId);
  if (current === undefined) {
    return ordered[0]?.id ?? null;
  }
  const from = anchor ?? anchorFor(current, null);
  if (current.links !== undefined && key !== 'ArrowUp') {
    return nextAlongBusbar(items, current, key, from);
  }
  const best = ordered
    .filter((item) => item.id !== current.id)
    .filter((item) => key !== 'ArrowDown' || item.links === undefined)
    .map((item) => ({ id: item.id, cost: distanceInDirection(from, item, key) }))
    .filter((entry): entry is { id: string; cost: number } => entry.cost !== null)
    .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))[0];
  return best?.id ?? null;
}
