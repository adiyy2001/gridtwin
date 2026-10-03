import type {
  Bay,
  BayKind,
  Substation,
  SwitchDescription,
  SwitchKind,
  TerminalKind,
} from '../model/api-types';

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type PartRole =
  | 'porcelain'
  | 'steel'
  | 'concrete'
  | 'housing'
  | 'transformer'
  | 'radiator'
  | 'load'
  | 'generator'
  | 'tower';

export type TerminalShape = 'LINE' | 'TRANSFORMER' | 'LOAD' | 'GENERATOR';

export interface BoxPart {
  readonly role: PartRole;
  readonly center: Vec3;
  readonly size: Vec3;
}

export interface CylinderPart {
  readonly role: PartRole;
  readonly from: Vec3;
  readonly to: Vec3;
  readonly radius: number;
}

export interface ConductorPlan {
  readonly id: string;
  readonly node: string;
  readonly terminalBay: string | null;
  readonly busbarNode: string | null;
  readonly from: Vec3;
  readonly to: Vec3;
  readonly radius: number;
}

export interface SwitchPlan {
  readonly id: string;
  readonly kind: SwitchKind;
  readonly bay: string;
  readonly conditionNode: string;
  readonly hinge: Vec3;
  readonly contact: Vec3;
  readonly swing: Vec3;
  readonly thickness: number;
  readonly openAngle: number;
}

export interface BusbarPlan {
  readonly node: string;
  readonly bus: number;
  readonly name: string;
  readonly from: Vec3;
  readonly to: Vec3;
}

export interface TerminalPlan {
  readonly bay: string;
  readonly bayName: string;
  readonly shape: TerminalShape;
  readonly kind: TerminalKind;
  readonly equipment: string;
  readonly node: string;
  readonly anchor: Vec3;
}

export interface BayPlan {
  readonly id: string;
  readonly name: string;
  readonly kind: BayKind;
  readonly x: number;
  readonly labelAt: Vec3;
}

export interface HitPlan {
  readonly id: string;
  readonly kind: 'switch' | 'busbar' | 'terminal';
  readonly center: Vec3;
  readonly size: Vec3;
}

export interface SceneBounds {
  readonly min: Vec3;
  readonly max: Vec3;
}

export interface ScenePlan {
  readonly bounds: SceneBounds;
  readonly bays: readonly BayPlan[];
  readonly busbars: readonly BusbarPlan[];
  readonly switches: readonly SwitchPlan[];
  readonly terminals: readonly TerminalPlan[];
  readonly conductors: readonly ConductorPlan[];
  readonly boxes: readonly BoxPart[];
  readonly cylinders: readonly CylinderPart[];
  readonly hits: readonly HitPlan[];
}

export const BAY_SPACING = 12;
export const BUSBAR_SPACING = 13;
export const BUSBAR_HEIGHT = 9;
export const BAY_HEIGHT = 5.4;
export const BUSBAR_RADIUS = 0.24;
export const CONDUCTOR_RADIUS = 0.13;
export const DISCONNECTOR_OPEN_ANGLE = (62 * Math.PI) / 180;
export const BREAKER_OPEN_ANGLE = (38 * Math.PI) / 180;
export const EARTHING_OPEN_ANGLE = (58 * Math.PI) / 180;

const EARTH_NODE = 'EARTH';
const BREAKER_Z = 14;
const BREAKER_HALF_SPAN = 1.3;
const LINE_DISCONNECTOR_Z = 20;
const SWITCH_HALF_SPAN = 1.4;
const EARTHING_Z = 23.6;
const EARTHING_OFFSET_X = 1.5;
const GANTRY_Z = 27;
const LINE_END_Z = 42;
const TRANSFORMER_Z = 29.5;
const BUSHING_Z = 27.4;
const LABEL_HEIGHT = 12.4;
const VERTICAL_CONTACT_HEIGHT = 8.2;

function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return vec((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

function nonEarthNode(entry: SwitchDescription): string {
  return entry.nodeA === EARTH_NODE ? entry.nodeB : entry.nodeA;
}

interface BusbarSlot {
  readonly node: string;
  readonly bus: number;
  readonly name: string;
  readonly z: number;
}

interface BayParts {
  readonly busDisconnectors: readonly SwitchDescription[];
  readonly breaker: SwitchDescription;
  readonly lineDisconnector: SwitchDescription | null;
  readonly earthing: readonly SwitchDescription[];
}

class Accumulator {
  readonly conductors: ConductorPlan[] = [];
  readonly boxes: BoxPart[] = [];
  readonly cylinders: CylinderPart[] = [];
  readonly switches: SwitchPlan[] = [];
  readonly terminals: TerminalPlan[] = [];
  readonly hits: HitPlan[] = [];
  readonly bays: BayPlan[] = [];

  conductor(
    node: string,
    from: Vec3,
    to: Vec3,
    options: { terminalBay?: string; busbarNode?: string; radius?: number } = {},
  ): void {
    this.conductors.push({
      id: `conductor-${this.conductors.length}`,
      node,
      terminalBay: options.terminalBay ?? null,
      busbarNode: options.busbarNode ?? null,
      from,
      to,
      radius: options.radius ?? CONDUCTOR_RADIUS,
    });
  }

  box(role: PartRole, center: Vec3, size: Vec3): void {
    this.boxes.push({ role, center, size });
  }

  cylinder(role: PartRole, from: Vec3, to: Vec3, radius: number): void {
    this.cylinders.push({ role, from, to, radius });
  }

  column(x: number, z: number, top: number, radius: number): void {
    this.cylinder('steel', vec(x, 0, z), vec(x, top, z), radius);
  }

  pole(x: number, z: number, bottom: number, top: number, radius: number): void {
    this.column(x, z, bottom, radius * 0.8);
    this.cylinder('porcelain', vec(x, bottom, z), vec(x, top, z), radius);
  }

  addSwitch(plan: SwitchPlan, hitSize: Vec3): void {
    this.switches.push(plan);
    this.hits.push({
      id: plan.id,
      kind: 'switch',
      center: midpoint(plan.hinge, plan.contact),
      size: hitSize,
    });
  }
}

function busbarSlots(substation: Substation): BusbarSlot[] {
  const ordered = [...substation.busbars].sort((a, b) => a.row - b.row);
  return ordered.map((busbar, order) => ({
    node: busbar.node,
    bus: busbar.bus,
    name: busbar.name,
    z: (order - (ordered.length - 1) / 2) * BUSBAR_SPACING,
  }));
}

function classify(
  bay: Bay,
  substation: Substation,
  busbarNodes: ReadonlySet<string>,
): BayParts | null {
  const inBay = substation.switches.filter((entry) => entry.bay === bay.id);
  const touchesBusbar = (entry: SwitchDescription): boolean =>
    busbarNodes.has(entry.nodeA) || busbarNodes.has(entry.nodeB);
  const breaker = inBay.find((entry) => entry.kind === 'BREAKER');
  if (breaker === undefined) {
    return null;
  }
  const disconnectors = inBay.filter((entry) => entry.kind === 'DISCONNECTOR');
  return {
    busDisconnectors: disconnectors.filter(touchesBusbar),
    breaker,
    lineDisconnector: disconnectors.find((entry) => !touchesBusbar(entry)) ?? null,
    earthing: inBay.filter((entry) => entry.kind === 'EARTHING_SWITCH'),
  };
}

function busbarOf(entry: SwitchDescription, slots: readonly BusbarSlot[]): BusbarSlot | null {
  return slots.find((slot) => slot.node === entry.nodeA || slot.node === entry.nodeB) ?? null;
}

function baySideNode(entry: SwitchDescription, slots: readonly BusbarSlot[]): string {
  return slots.some((slot) => slot.node === entry.nodeA) ? entry.nodeB : entry.nodeA;
}

function horizontalSwitch(
  entry: SwitchDescription,
  x: number,
  centerZ: number,
  halfSpan: number,
  thickness: number,
  openAngle: number,
): SwitchPlan {
  return {
    id: entry.id,
    kind: entry.kind,
    bay: entry.bay,
    conditionNode: nonEarthNode(entry),
    hinge: vec(x, BAY_HEIGHT, centerZ - halfSpan),
    contact: vec(x, BAY_HEIGHT, centerZ + halfSpan),
    swing: vec(0, 1, 0),
    thickness,
    openAngle,
  };
}

function earthingSwitch(entry: SwitchDescription, x: number, z: number, acc: Accumulator): void {
  const node = nonEarthNode(entry);
  const baseX = x + EARTHING_OFFSET_X;
  const contact = vec(baseX, BAY_HEIGHT - 0.8, z);
  acc.conductor(node, vec(x, BAY_HEIGHT, z), contact);
  acc.column(baseX, z, 1.3, 0.12);
  acc.box('concrete', vec(baseX, 0.15, z), vec(1.4, 0.3, 1.4));
  acc.cylinder('porcelain', vec(baseX + 0.5, 1.3, z), vec(baseX + 0.5, contact.y, z), 0.12);
  acc.addSwitch(
    {
      id: entry.id,
      kind: entry.kind,
      bay: entry.bay,
      conditionNode: node,
      hinge: vec(baseX, 1.3, z),
      contact,
      swing: vec(1, 0, 0),
      thickness: 0.14,
      openAngle: EARTHING_OPEN_ANGLE,
    },
    vec(1.8, 4.2, 1.8),
  );
}

function breakerAssembly(entry: SwitchDescription, x: number, z: number, acc: Accumulator): void {
  acc.box('housing', vec(x, 1.45, z), vec(1.9, 2.5, 3.6));
  acc.cylinder(
    'porcelain',
    vec(x, 2.7, z - BREAKER_HALF_SPAN),
    vec(x, BAY_HEIGHT, z - BREAKER_HALF_SPAN),
    0.3,
  );
  acc.cylinder(
    'porcelain',
    vec(x, 2.7, z + BREAKER_HALF_SPAN),
    vec(x, BAY_HEIGHT, z + BREAKER_HALF_SPAN),
    0.3,
  );
  acc.addSwitch(
    horizontalSwitch(entry, x, z, BREAKER_HALF_SPAN, 0.28, BREAKER_OPEN_ANGLE),
    vec(2.2, 4.8, 4.6),
  );
}

function disconnectorAssembly(
  entry: SwitchDescription,
  x: number,
  z: number,
  acc: Accumulator,
): void {
  acc.pole(x, z - SWITCH_HALF_SPAN, 3.2, BAY_HEIGHT, 0.15);
  acc.pole(x, z + SWITCH_HALF_SPAN, 3.2, BAY_HEIGHT, 0.15);
  acc.addSwitch(
    horizontalSwitch(entry, x, z, SWITCH_HALF_SPAN, 0.16, DISCONNECTOR_OPEN_ANGLE),
    vec(1.8, 3.6, 3.8),
  );
}

function busDisconnectorAssembly(
  entry: SwitchDescription,
  x: number,
  slot: BusbarSlot,
  swingSign: number,
  acc: Accumulator,
): void {
  const hinge = vec(x, BAY_HEIGHT, slot.z);
  const contact = vec(x, VERTICAL_CONTACT_HEIGHT, slot.z);
  acc.pole(x, slot.z, 3.2, BAY_HEIGHT, 0.15);
  acc.cylinder(
    'porcelain',
    vec(x + 0.6, BAY_HEIGHT, slot.z),
    vec(x + 0.6, VERTICAL_CONTACT_HEIGHT, slot.z),
    0.13,
  );
  acc.conductor(slot.node, vec(x, BUSBAR_HEIGHT, slot.z), contact, { busbarNode: slot.node });
  acc.conductor(slot.node, contact, vec(x + 0.6, VERTICAL_CONTACT_HEIGHT, slot.z));
  acc.addSwitch(
    {
      id: entry.id,
      kind: entry.kind,
      bay: entry.bay,
      conditionNode: nonEarthNode(entry),
      hinge,
      contact,
      swing: vec(0, 0, swingSign),
      thickness: 0.16,
      openAngle: DISCONNECTOR_OPEN_ANGLE,
    },
    vec(2.4, 4.6, 2.4),
  );
}

function busSupports(x: number, slots: readonly BusbarSlot[], acc: Accumulator): void {
  slots.forEach((slot) => {
    acc.column(x + 2.6, slot.z, 8, 0.2);
    acc.cylinder(
      'porcelain',
      vec(x + 2.6, 8, slot.z),
      vec(x + 2.6, BUSBAR_HEIGHT - 0.2, slot.z),
      0.17,
    );
  });
}

function terminalShape(kind: TerminalKind, transformer: boolean): TerminalShape {
  if (kind === 'LOAD') {
    return 'LOAD';
  }
  if (kind === 'GENERATOR') {
    return 'GENERATOR';
  }
  return transformer ? 'TRANSFORMER' : 'LINE';
}

function lineExit(x: number, node: string, bay: string, acc: Accumulator): void {
  const end = vec(x, BAY_HEIGHT, GANTRY_Z - 1);
  acc.conductor(node, vec(x, BAY_HEIGHT, LINE_DISCONNECTOR_Z + SWITCH_HALF_SPAN), end);
  acc.column(x - 3, GANTRY_Z, 8.8, 0.22);
  acc.column(x + 3, GANTRY_Z, 8.8, 0.22);
  acc.box('steel', vec(x, 8.8, GANTRY_Z), vec(6.6, 0.35, 0.35));
  acc.cylinder('porcelain', vec(x, 8.8, GANTRY_Z), vec(x, 7.2, GANTRY_Z), 0.16);
  acc.conductor(node, end, vec(x, 7.2, GANTRY_Z), { terminalBay: bay });
  acc.conductor(node, vec(x, 7.2, GANTRY_Z), vec(x, 6.4, LINE_END_Z), { terminalBay: bay });
  acc.box('tower', vec(x, 5, LINE_END_Z), vec(0.6, 10, 0.6));
  acc.box('tower', vec(x, 9.2, LINE_END_Z), vec(6, 0.3, 0.3));
}

function bushingFeed(x: number, node: string, bay: string, acc: Accumulator): void {
  const split = vec(x, BAY_HEIGHT, BUSHING_Z - 2.2);
  acc.conductor(node, vec(x, BAY_HEIGHT, LINE_DISCONNECTOR_Z + SWITCH_HALF_SPAN), split);
  acc.conductor(node, split, vec(x, BAY_HEIGHT, BUSHING_Z), { terminalBay: bay });
  acc.cylinder('porcelain', vec(x, 3.8, BUSHING_Z), vec(x, BAY_HEIGHT, BUSHING_Z), 0.22);
}

function transformerBody(x: number, acc: Accumulator): void {
  acc.box('transformer', vec(x, 1.9, TRANSFORMER_Z), vec(4.2, 3.8, 6));
  acc.box('radiator', vec(x - 2.55, 1.9, TRANSFORMER_Z), vec(0.5, 2.9, 4.6));
  acc.box('radiator', vec(x + 2.55, 1.9, TRANSFORMER_Z), vec(0.5, 2.9, 4.6));
  acc.cylinder(
    'transformer',
    vec(x, 4.5, TRANSFORMER_Z - 1.5),
    vec(x, 4.5, TRANSFORMER_Z + 2.5),
    0.5,
  );
  [-1.2, 0, 1.2].forEach((offset) => {
    acc.cylinder('porcelain', vec(x + offset, 3.8, 31.6), vec(x + offset, 5, 31.6), 0.16);
  });
  acc.box('concrete', vec(x, 0.1, TRANSFORMER_Z), vec(6.6, 0.2, 7.4));
}

function loadBody(x: number, acc: Accumulator): void {
  acc.box('load', vec(x, 1.6, TRANSFORMER_Z), vec(5, 3.2, 5));
  acc.box('steel', vec(x, 3.4, TRANSFORMER_Z), vec(5.6, 0.4, 5.6));
  acc.box('concrete', vec(x, 0.1, TRANSFORMER_Z), vec(6.6, 0.2, 7.4));
}

function generatorBody(x: number, acc: Accumulator): void {
  acc.cylinder(
    'generator',
    vec(x, 2.3, TRANSFORMER_Z - 2.6),
    vec(x, 2.3, TRANSFORMER_Z + 2.6),
    1.9,
  );
  acc.box('concrete', vec(x, 0.2, TRANSFORMER_Z), vec(4.4, 0.4, 7.4));
}

function terminalHit(shape: TerminalShape, x: number): { center: Vec3; size: Vec3 } {
  if (shape === 'LINE') {
    return {
      center: vec(x, 6.5, (GANTRY_Z + LINE_END_Z) / 2),
      size: vec(2.4, 3.4, LINE_END_Z - GANTRY_Z + 2),
    };
  }
  return { center: vec(x, 2.6, TRANSFORMER_Z), size: vec(5.6, 5.8, 6.6) };
}

function feederBay(
  bay: Bay,
  parts: BayParts,
  x: number,
  slots: readonly BusbarSlot[],
  transformers: ReadonlySet<string>,
  acc: Accumulator,
): void {
  const ordered = parts.busDisconnectors
    .map((entry) => ({ entry, slot: busbarOf(entry, slots) }))
    .flatMap(({ entry, slot }) => (slot === null ? [] : [{ entry, slot }]))
    .sort((a, b) => a.slot.z - b.slot.z);
  const center =
    slots.length === 0 ? 0 : slots.reduce((sum, slot) => sum + slot.z, 0) / slots.length;
  const busSideNode =
    ordered[0] === undefined ? parts.breaker.nodeA : baySideNode(ordered[0].entry, slots);
  const breakerBusSide =
    parts.breaker.nodeA === busSideNode ? parts.breaker.nodeA : parts.breaker.nodeB;
  const breakerFarSide =
    breakerBusSide === parts.breaker.nodeA ? parts.breaker.nodeB : parts.breaker.nodeA;
  const startZ = ordered[0]?.slot.z ?? BREAKER_Z - 4;

  ordered.forEach(({ entry, slot }) => {
    busDisconnectorAssembly(entry, x, slot, slot.z < center ? -1 : 1, acc);
  });
  acc.conductor(
    breakerBusSide,
    vec(x, BAY_HEIGHT, startZ),
    vec(x, BAY_HEIGHT, BREAKER_Z - BREAKER_HALF_SPAN),
  );
  breakerAssembly(parts.breaker, x, BREAKER_Z, acc);
  acc.conductor(
    breakerFarSide,
    vec(x, BAY_HEIGHT, BREAKER_Z + BREAKER_HALF_SPAN),
    vec(x, BAY_HEIGHT, LINE_DISCONNECTOR_Z - SWITCH_HALF_SPAN),
  );
  const terminalNode = bay.terminal?.node ?? breakerFarSide;
  if (parts.lineDisconnector !== null) {
    disconnectorAssembly(parts.lineDisconnector, x, LINE_DISCONNECTOR_Z, acc);
  }
  const earthingZ = new Map<string, number>([
    [busSideNode, BREAKER_Z - BREAKER_HALF_SPAN - 1.5],
    [breakerFarSide, (BREAKER_Z + LINE_DISCONNECTOR_Z) / 2 + 0.6],
    [terminalNode, EARTHING_Z],
  ]);
  parts.earthing.forEach((entry) => {
    earthingSwitch(entry, x, earthingZ.get(nonEarthNode(entry)) ?? EARTHING_Z, acc);
  });

  const terminal = bay.terminal;
  if (terminal !== undefined && terminal !== null) {
    const shape = terminalShape(terminal.kind, transformers.has(terminal.equipment));
    acc.terminals.push({
      bay: bay.id,
      bayName: bay.name,
      shape,
      kind: terminal.kind,
      equipment: terminal.equipment,
      node: terminal.node,
      anchor: vec(x, BAY_HEIGHT, shape === 'LINE' ? GANTRY_Z : BUSHING_Z),
    });
    if (shape === 'LINE') {
      lineExit(x, terminal.node, bay.id, acc);
    } else {
      bushingFeed(x, terminal.node, bay.id, acc);
      if (shape === 'TRANSFORMER') {
        transformerBody(x, acc);
      } else if (shape === 'LOAD') {
        loadBody(x, acc);
      } else {
        generatorBody(x, acc);
      }
    }
    const hit = terminalHit(shape, x);
    acc.hits.push({
      id: `terminal:${bay.id}`,
      kind: 'terminal',
      center: hit.center,
      size: hit.size,
    });
  }
  acc.bays.push({
    id: bay.id,
    name: bay.name,
    kind: bay.kind,
    x,
    labelAt: vec(x, LABEL_HEIGHT, 24.5),
  });
}

function couplerBay(
  bay: Bay,
  parts: BayParts,
  x: number,
  slots: readonly BusbarSlot[],
  acc: Accumulator,
): void {
  const first = slots[0];
  const last = slots[slots.length - 1];
  if (first === undefined || last === undefined) {
    return;
  }
  const firstSide = parts.busDisconnectors.find((entry) => busbarOf(entry, [first]) !== null);
  const lastSide = parts.busDisconnectors.find((entry) => busbarOf(entry, [last]) !== null);
  const nodeNearFirst =
    firstSide === undefined ? parts.breaker.nodeA : baySideNode(firstSide, slots);
  const nodeNearLast =
    nodeNearFirst === parts.breaker.nodeA ? parts.breaker.nodeB : parts.breaker.nodeA;
  const innerFirst = first.z + 1.1;
  const innerLast = last.z - 1.1;
  const breakerFirst = -BREAKER_HALF_SPAN;
  const breakerLast = BREAKER_HALF_SPAN;
  const switchSpan = 1.2;

  acc.conductor(first.node, vec(x, BUSBAR_HEIGHT, first.z), vec(x, BAY_HEIGHT, first.z), {
    busbarNode: first.node,
  });
  acc.conductor(first.node, vec(x, BAY_HEIGHT, first.z), vec(x, BAY_HEIGHT, innerFirst));
  acc.conductor(last.node, vec(x, BUSBAR_HEIGHT, last.z), vec(x, BAY_HEIGHT, last.z), {
    busbarNode: last.node,
  });
  acc.conductor(last.node, vec(x, BAY_HEIGHT, last.z), vec(x, BAY_HEIGHT, innerLast));

  if (firstSide !== undefined) {
    const centerZ = innerFirst + switchSpan;
    acc.pole(x, centerZ - switchSpan, 3.2, BAY_HEIGHT, 0.15);
    acc.pole(x, centerZ + switchSpan, 3.2, BAY_HEIGHT, 0.15);
    acc.addSwitch(
      horizontalSwitch(firstSide, x, centerZ, switchSpan, 0.16, DISCONNECTOR_OPEN_ANGLE),
      vec(1.8, 3.6, 3.4),
    );
    acc.conductor(
      nodeNearFirst,
      vec(x, BAY_HEIGHT, centerZ + switchSpan),
      vec(x, BAY_HEIGHT, breakerFirst),
    );
  } else {
    acc.conductor(nodeNearFirst, vec(x, BAY_HEIGHT, innerFirst), vec(x, BAY_HEIGHT, breakerFirst));
  }
  if (lastSide !== undefined) {
    const centerZ = innerLast - switchSpan;
    acc.pole(x, centerZ - switchSpan, 3.2, BAY_HEIGHT, 0.15);
    acc.pole(x, centerZ + switchSpan, 3.2, BAY_HEIGHT, 0.15);
    acc.addSwitch(
      horizontalSwitch(lastSide, x, centerZ, switchSpan, 0.16, DISCONNECTOR_OPEN_ANGLE),
      vec(1.8, 3.6, 3.4),
    );
    acc.conductor(
      nodeNearLast,
      vec(x, BAY_HEIGHT, breakerLast),
      vec(x, BAY_HEIGHT, centerZ - switchSpan),
    );
  } else {
    acc.conductor(nodeNearLast, vec(x, BAY_HEIGHT, breakerLast), vec(x, BAY_HEIGHT, innerLast));
  }
  breakerAssembly(parts.breaker, x, 0, acc);

  const earthingZ = new Map<string, number>([
    [nodeNearFirst, breakerFirst - 1.1],
    [nodeNearLast, breakerLast + 1.1],
  ]);
  parts.earthing.forEach((entry) => {
    const node = nonEarthNode(entry);
    const z = earthingZ.get(node);
    if (z !== undefined) {
      earthingSwitch(entry, x, z, acc);
    }
  });
  acc.bays.push({
    id: bay.id,
    name: bay.name,
    kind: bay.kind,
    x,
    labelAt: vec(x, LABEL_HEIGHT - 1, 0),
  });
}

export function buildScenePlan(
  substation: Substation,
  transformers: ReadonlySet<string> = new Set(),
): ScenePlan {
  const slots = busbarSlots(substation);
  const busbarNodes = new Set(slots.map((slot) => slot.node));
  const columns = substation.bays.map((bay) => bay.column);
  const firstColumn = Math.min(...columns, 0);
  const lastColumn = Math.max(...columns, 0);
  const xOf = (column: number): number => (column - (firstColumn + lastColumn) / 2) * BAY_SPACING;
  const acc = new Accumulator();

  substation.bays.forEach((bay) => {
    const parts = classify(bay, substation, busbarNodes);
    if (parts === null) {
      return;
    }
    const x = xOf(bay.column);
    busSupports(x, slots, acc);
    if (bay.kind === 'COUPLER') {
      couplerBay(bay, parts, x, slots, acc);
    } else {
      feederBay(bay, parts, x, slots, transformers, acc);
    }
  });

  const xs = acc.bays.map((bay) => bay.x);
  const minX = (xs.length === 0 ? 0 : Math.min(...xs)) - BAY_SPACING / 2 - 3;
  const maxX = (xs.length === 0 ? 0 : Math.max(...xs)) + BAY_SPACING / 2 + 3;
  const busbars: BusbarPlan[] = slots.map((slot) => ({
    node: slot.node,
    bus: slot.bus,
    name: slot.name,
    from: vec(minX, BUSBAR_HEIGHT, slot.z),
    to: vec(maxX, BUSBAR_HEIGHT, slot.z),
  }));
  busbars.forEach((busbar) => {
    acc.hits.push({
      id: `busbar:${busbar.node}`,
      kind: 'busbar',
      center: midpoint(busbar.from, busbar.to),
      size: vec(busbar.to.x - busbar.from.x, 1.8, 1.8),
    });
  });
  const zs = slots.map((slot) => slot.z);
  return {
    bounds: {
      min: vec(minX, 0, Math.min(...zs, 0) - 4),
      max: vec(maxX, 12, LINE_END_Z + 2),
    },
    bays: acc.bays,
    busbars,
    switches: acc.switches,
    terminals: acc.terminals,
    conductors: acc.conductors,
    boxes: acc.boxes,
    cylinders: acc.cylinders,
    hits: acc.hits,
  };
}

export function busbarEquipmentId(node: string): string {
  return `busbar:${node}`;
}

export function terminalEquipmentId(bay: string): string {
  return `terminal:${bay}`;
}

export function planCenter(plan: ScenePlan): Vec3 {
  return midpoint(plan.bounds.min, plan.bounds.max);
}
