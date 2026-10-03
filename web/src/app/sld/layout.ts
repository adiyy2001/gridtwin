import type {
  Bay,
  BayKind,
  Substation,
  SwitchDescription,
  SwitchKind,
  TerminalKind,
} from '../model/api-types';
import { SWITCH_HALF_LENGTH, TERMINAL_LENGTH } from './symbols';

export const COLUMN_WIDTH = 124;
export const MARGIN_LEFT = 96;
export const MARGIN_RIGHT = 56;
export const BUSBAR_OVERHANG = 56;
export const FIRST_BUSBAR_Y = 74;
export const BUSBAR_GAP = 58;
export const JUNCTION_GAP = 60;
export const BREAKER_GAP = 36;
export const SPUR_OFFSET = 15;
export const COUPLER_OFFSET = 21;
export const EARTHING_OFFSET = 30;
export const CAPTION_LINE_HEIGHT = 16;
export const CAPTION_WIDTH_LIMIT = 17;
export const BOTTOM_PADDING = 30;

const EARTH_NODE = 'EARTH';
const LINE_DISCONNECTOR_GAP = 3 * SWITCH_HALF_LENGTH;
const EARTHING_DROP = SWITCH_HALF_LENGTH + 16;
const TERMINAL_DROP = 24;
const CAPTION_DROP = TERMINAL_LENGTH + 20;
const COUPLER_LOWER_GAP = 40;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface SldWire {
  readonly id: string;
  readonly node: string;
  readonly d: string;
}

export interface SldSwitch {
  readonly id: string;
  readonly kind: SwitchKind;
  readonly bay: string;
  readonly bayName: string;
  readonly shortName: string;
  readonly x: number;
  readonly y: number;
  readonly nodeA: string;
  readonly nodeB: string;
  readonly labelAt: Point;
  readonly labelAnchor: 'start' | 'end';
}

export interface SldBusbar {
  readonly node: string;
  readonly bus: number;
  readonly name: string;
  readonly y: number;
  readonly x1: number;
  readonly x2: number;
}

export interface SldTerminal {
  readonly bay: string;
  readonly bayName: string;
  readonly kind: TerminalKind;
  readonly equipment: string;
  readonly node: string;
  readonly x: number;
  readonly y: number;
}

export interface SldCaption {
  readonly bay: string;
  readonly bayKind: BayKind;
  readonly x: number;
  readonly y: number;
  readonly lines: readonly string[];
  readonly statusNode: string;
}

export interface SldJunction {
  readonly x: number;
  readonly y: number;
  readonly node: string;
}

export interface SldLayout {
  readonly width: number;
  readonly height: number;
  readonly busbars: readonly SldBusbar[];
  readonly switches: readonly SldSwitch[];
  readonly wires: readonly SldWire[];
  readonly terminals: readonly SldTerminal[];
  readonly junctions: readonly SldJunction[];
  readonly captions: readonly SldCaption[];
}

interface Rows {
  readonly busbarY: ReadonlyMap<string, number>;
  readonly junctionY: number;
  readonly breakerY: number;
  readonly lineDisconnectorY: number;
  readonly earthingY: number;
  readonly terminalY: number;
  readonly captionY: number;
  readonly couplerLowerY: number;
}

interface Accumulator {
  readonly wires: SldWire[];
  readonly switches: SldSwitch[];
  readonly terminals: SldTerminal[];
  readonly junctions: SldJunction[];
  readonly captions: SldCaption[];
}

type Side = 'left' | 'right';

function computeRows(substation: Substation): Rows {
  const ordered = [...substation.busbars].sort((a, b) => a.row - b.row);
  const busbarY = new Map(
    ordered.map((busbar, order) => [busbar.node, FIRST_BUSBAR_Y + order * BUSBAR_GAP]),
  );
  const lastBusbarY = FIRST_BUSBAR_Y + Math.max(ordered.length - 1, 0) * BUSBAR_GAP;
  const junctionY = lastBusbarY + JUNCTION_GAP;
  const breakerY = junctionY + BREAKER_GAP;
  const lineDisconnectorY = breakerY + LINE_DISCONNECTOR_GAP;
  const earthingY = lineDisconnectorY + EARTHING_DROP;
  const terminalY = earthingY + TERMINAL_DROP;
  return {
    busbarY,
    junctionY,
    breakerY,
    lineDisconnectorY,
    earthingY,
    terminalY,
    captionY: terminalY + CAPTION_DROP,
    couplerLowerY: breakerY + SWITCH_HALF_LENGTH + COUPLER_LOWER_GAP,
  };
}

function shortName(id: string): string {
  const dot = id.lastIndexOf('.');
  return dot === -1 ? id : id.slice(dot + 1);
}

function wrapWords(text: string, limit: number): string[] {
  return text.split(/\s+/).reduce<string[]>((lines, word) => {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= limit) {
      return [...lines.slice(0, -1), `${last} ${word}`];
    }
    return [...lines, word];
  }, []);
}

function vertical(x: number, from: number, to: number): string {
  return `M${x} ${from} V${to}`;
}

function horizontal(y: number, from: number, to: number): string {
  return `M${from} ${y} H${to}`;
}

function busbarOf(entry: SwitchDescription, rows: Rows): string | null {
  if (rows.busbarY.has(entry.nodeA)) {
    return entry.nodeA;
  }
  return rows.busbarY.has(entry.nodeB) ? entry.nodeB : null;
}

function otherEnd(entry: SwitchDescription, node: string): string {
  return entry.nodeA === node ? entry.nodeB : entry.nodeA;
}

function touches(entry: SwitchDescription, node: string): boolean {
  return entry.nodeA === node || entry.nodeB === node;
}

function nextBoundary(busbarNode: string, rows: Rows, fallback: number): number {
  const current = rows.busbarY.get(busbarNode) ?? 0;
  const below = [...rows.busbarY.values()].filter((y) => y > current).sort((a, b) => a - b);
  return below[0] ?? fallback;
}

function placeSwitch(
  acc: Accumulator,
  entry: SwitchDescription,
  bay: Bay,
  at: Point,
  side: Side,
): void {
  const reach = entry.kind === 'EARTHING_SWITCH' ? 12 : 14;
  acc.switches.push({
    id: entry.id,
    kind: entry.kind,
    bay: bay.id,
    bayName: bay.name,
    shortName: shortName(entry.id),
    x: at.x,
    y: at.y,
    nodeA: entry.nodeA,
    nodeB: entry.nodeB,
    labelAt: { x: side === 'right' ? at.x + reach : at.x - reach, y: at.y + 4 },
    labelAnchor: side === 'right' ? 'start' : 'end',
  });
}

function addEarthing(
  acc: Accumulator,
  entry: SwitchDescription,
  bay: Bay,
  from: Point,
  side: Side,
): void {
  const x = from.x + (side === 'right' ? EARTHING_OFFSET : -EARTHING_OFFSET);
  acc.wires.push({
    id: `${entry.id}.wire`,
    node: otherEnd(entry, EARTH_NODE),
    d: horizontal(from.y, from.x, x),
  });
  placeSwitch(acc, entry, bay, { x, y: from.y }, side);
}

function addCaption(acc: Accumulator, bay: Bay, x: number, rows: Rows, statusNode: string): void {
  acc.captions.push({
    bay: bay.id,
    bayKind: bay.kind,
    x,
    y: rows.captionY,
    lines: [bay.id, ...wrapWords(bay.name, CAPTION_WIDTH_LIMIT)],
    statusNode,
  });
}

interface Spur {
  readonly entry: SwitchDescription;
  readonly busbarNode: string;
  readonly busbarY: number;
  readonly x: number;
  readonly y: number;
}

function buildSpurs(busSwitches: readonly SwitchDescription[], rows: Rows, cx: number): Spur[] {
  return busSwitches.flatMap((entry, order) => {
    const busbarNode = busbarOf(entry, rows);
    if (busbarNode === null) {
      return [];
    }
    const busbarY = rows.busbarY.get(busbarNode) ?? 0;
    const boundary = nextBoundary(busbarNode, rows, rows.junctionY);
    return [
      {
        entry,
        busbarNode,
        busbarY,
        x: cx + (order - (busSwitches.length - 1) / 2) * 2 * SPUR_OFFSET,
        y: busbarY + (boundary - busbarY) / 2,
      },
    ];
  });
}

function layoutFeeder(
  acc: Accumulator,
  bay: Bay,
  entries: readonly SwitchDescription[],
  rows: Rows,
  cx: number,
): void {
  const breaker = entries.find((entry) => entry.kind === 'BREAKER');
  if (breaker === undefined) {
    return;
  }
  const busSwitches = entries
    .filter((entry) => entry.kind === 'DISCONNECTOR' && busbarOf(entry, rows) !== null)
    .sort(
      (a, b) =>
        (rows.busbarY.get(busbarOf(a, rows) ?? '') ?? 0) -
        (rows.busbarY.get(busbarOf(b, rows) ?? '') ?? 0),
    );
  const lineDisconnector = entries.find(
    (entry) =>
      entry.kind === 'DISCONNECTOR' &&
      busbarOf(entry, rows) === null &&
      touches(entry, breaker.nodeB),
  );
  const spurs = buildSpurs(busSwitches, rows, cx);

  spurs.forEach((spur, order) => {
    acc.wires.push({
      id: `${spur.entry.id}.upper`,
      node: spur.busbarNode,
      d: vertical(spur.x, spur.busbarY, spur.y - SWITCH_HALF_LENGTH),
    });
    acc.junctions.push({ x: spur.x, y: spur.busbarY, node: spur.busbarNode });
    placeSwitch(acc, spur.entry, bay, spur, order === 0 && spurs.length > 1 ? 'left' : 'right');
  });

  const left = Math.min(cx, ...spurs.map((spur) => spur.x));
  const right = Math.max(cx, ...spurs.map((spur) => spur.x));
  acc.wires.push({
    id: `${bay.id}.upper-node`,
    node: breaker.nodeA,
    d: [
      ...spurs.map((spur) => vertical(spur.x, spur.y + SWITCH_HALF_LENGTH, rows.junctionY)),
      horizontal(rows.junctionY, left, right),
      vertical(cx, rows.junctionY, rows.breakerY - SWITCH_HALF_LENGTH),
    ].join(' '),
  });
  if (spurs.length > 1) {
    acc.junctions.push({ x: cx, y: rows.junctionY, node: breaker.nodeA });
  }
  placeSwitch(acc, breaker, bay, { x: cx, y: rows.breakerY }, 'right');

  const lowerEnd =
    lineDisconnector === undefined ? rows.terminalY : rows.lineDisconnectorY - SWITCH_HALF_LENGTH;
  acc.wires.push({
    id: `${bay.id}.lower-node`,
    node: breaker.nodeB,
    d: vertical(cx, rows.breakerY + SWITCH_HALF_LENGTH, lowerEnd),
  });

  const terminalNode = bay.terminal?.node ?? breaker.nodeB;
  if (lineDisconnector !== undefined) {
    placeSwitch(acc, lineDisconnector, bay, { x: cx, y: rows.lineDisconnectorY }, 'right');
    acc.wires.push({
      id: `${bay.id}.terminal-node`,
      node: terminalNode,
      d: vertical(cx, rows.lineDisconnectorY + SWITCH_HALF_LENGTH, rows.terminalY),
    });
  }

  entries
    .filter((entry) => entry.kind === 'EARTHING_SWITCH')
    .forEach((entry) => {
      addEarthing(acc, entry, bay, { x: cx, y: rows.earthingY }, 'right');
    });

  if (bay.terminal !== undefined && bay.terminal !== null) {
    acc.terminals.push({
      bay: bay.id,
      bayName: bay.name,
      kind: bay.terminal.kind,
      equipment: bay.terminal.equipment,
      node: bay.terminal.node,
      x: cx,
      y: rows.terminalY,
    });
  }
  addCaption(acc, bay, cx, rows, terminalNode);
}

function layoutCoupler(
  acc: Accumulator,
  bay: Bay,
  entries: readonly SwitchDescription[],
  rows: Rows,
  cx: number,
): void {
  const breaker = entries.find((entry) => entry.kind === 'BREAKER');
  if (breaker === undefined) {
    return;
  }
  const leftX = cx - COUPLER_OFFSET;
  const rightX = cx + COUPLER_OFFSET;
  const busSwitches = entries.filter(
    (entry) => entry.kind === 'DISCONNECTOR' && busbarOf(entry, rows) !== null,
  );
  const leftDisconnector = busSwitches.find((entry) => touches(entry, breaker.nodeA));
  const rightDisconnector = busSwitches.find((entry) => touches(entry, breaker.nodeB));
  const leftBusbar = leftDisconnector === undefined ? null : busbarOf(leftDisconnector, rows);
  const rightBusbar = rightDisconnector === undefined ? null : busbarOf(rightDisconnector, rows);

  const leftBusbarY = rows.busbarY.get(leftBusbar ?? '') ?? FIRST_BUSBAR_Y;
  const leftY =
    leftBusbarY + (nextBoundary(leftBusbar ?? '', rows, rows.junctionY) - leftBusbarY) / 2;
  if (leftDisconnector !== undefined && leftBusbar !== null) {
    acc.wires.push({
      id: `${leftDisconnector.id}.upper`,
      node: leftBusbar,
      d: vertical(leftX, leftBusbarY, leftY - SWITCH_HALF_LENGTH),
    });
    acc.junctions.push({ x: leftX, y: leftBusbarY, node: leftBusbar });
    placeSwitch(acc, leftDisconnector, bay, { x: leftX, y: leftY }, 'left');
  }
  acc.wires.push({
    id: `${bay.id}.left-node`,
    node: breaker.nodeA,
    d: vertical(
      leftX,
      leftDisconnector === undefined ? leftBusbarY : leftY + SWITCH_HALF_LENGTH,
      rows.breakerY - SWITCH_HALF_LENGTH,
    ),
  });
  placeSwitch(acc, breaker, bay, { x: leftX, y: rows.breakerY }, 'left');

  const rightBusbarY = rows.busbarY.get(rightBusbar ?? '') ?? FIRST_BUSBAR_Y;
  const rightY = (rightBusbarY + rows.couplerLowerY) / 2;
  acc.wires.push({
    id: `${bay.id}.right-node`,
    node: breaker.nodeB,
    d: [
      vertical(leftX, rows.breakerY + SWITCH_HALF_LENGTH, rows.couplerLowerY),
      horizontal(rows.couplerLowerY, leftX, rightX),
      vertical(rightX, rows.couplerLowerY, rightY + SWITCH_HALF_LENGTH),
    ].join(' '),
  });
  acc.junctions.push({ x: leftX, y: rows.couplerLowerY, node: breaker.nodeB });
  if (rightDisconnector !== undefined && rightBusbar !== null) {
    acc.wires.push({
      id: `${rightDisconnector.id}.upper`,
      node: rightBusbar,
      d: vertical(rightX, rightBusbarY, rightY - SWITCH_HALF_LENGTH),
    });
    acc.junctions.push({ x: rightX, y: rightBusbarY, node: rightBusbar });
    placeSwitch(acc, rightDisconnector, bay, { x: rightX, y: rightY }, 'right');
  }

  entries
    .filter((entry) => entry.kind === 'EARTHING_SWITCH')
    .forEach((entry) => {
      const onLeft = touches(entry, breaker.nodeA);
      const from = onLeft
        ? { x: leftX, y: rows.breakerY - SWITCH_HALF_LENGTH - 26 }
        : { x: rightX, y: rows.couplerLowerY - 26 };
      addEarthing(acc, entry, bay, from, onLeft ? 'left' : 'right');
    });

  addCaption(acc, bay, cx, rows, breaker.nodeA);
}

export function buildSldLayout(substation: Substation): SldLayout {
  const rows = computeRows(substation);
  const acc: Accumulator = { wires: [], switches: [], terminals: [], junctions: [], captions: [] };
  const columns = substation.bays.map((bay) => bay.column);
  const firstColumn = Math.min(...columns);
  const lastColumn = Math.max(...columns);
  const columnX = (column: number): number =>
    MARGIN_LEFT + BUSBAR_OVERHANG + (column - firstColumn) * COLUMN_WIDTH;

  substation.bays.forEach((bay) => {
    const entries = substation.switches.filter((entry) => entry.bay === bay.id);
    if (bay.kind === 'COUPLER') {
      layoutCoupler(acc, bay, entries, rows, columnX(bay.column));
    } else {
      layoutFeeder(acc, bay, entries, rows, columnX(bay.column));
    }
  });

  const x2 = columnX(lastColumn) + BUSBAR_OVERHANG;
  const busbars = substation.busbars.map((busbar) => ({
    node: busbar.node,
    bus: busbar.bus,
    name: busbar.name,
    y: rows.busbarY.get(busbar.node) ?? FIRST_BUSBAR_Y,
    x1: MARGIN_LEFT,
    x2,
  }));
  const captionLines = Math.max(...acc.captions.map((caption) => caption.lines.length), 1);
  return {
    width: x2 + MARGIN_RIGHT,
    height: rows.captionY + captionLines * CAPTION_LINE_HEIGHT + BOTTOM_PADDING,
    busbars,
    switches: acc.switches,
    wires: acc.wires,
    terminals: acc.terminals,
    junctions: acc.junctions,
    captions: acc.captions,
  };
}
