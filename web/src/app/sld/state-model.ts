import type {
  BranchState,
  BusState,
  NodeCondition,
  Position,
  Substation,
  SwitchKind,
} from '../model/api-types';
import type { Selection } from '../model/selection';
import { sameSelection } from '../model/selection';
import { formatMw, formatPercent, oppositePosition, positionLabel } from '../shared/format';
import type { NavItem } from './keyboard';
import type { SldBusbar, SldLayout, SldSwitch, SldTerminal } from './layout';
import {
  SWITCH_HALF_LENGTH,
  TERMINAL_LENGTH,
  earthingSymbol,
  switchSymbol,
  terminalSymbol,
} from './symbols';
import type { EarthingSymbol, SwitchSymbol, TerminalSymbol } from './symbols';

export type Condition = NodeCondition;

export interface SldInput {
  readonly layout: SldLayout;
  readonly substation: Substation;
  readonly nodeStates: ReadonlyMap<string, NodeCondition>;
  readonly positions: ReadonlyMap<string, Position>;
  readonly branches: ReadonlyMap<string, BranchState>;
  readonly transformers: ReadonlySet<string>;
  readonly buses: ReadonlyMap<number, BusState>;
  readonly selection: Selection | null;
  readonly hover: Selection | null;
  readonly operable: boolean;
}

export interface WireModel {
  readonly id: string;
  readonly d: string;
  readonly condition: Condition;
}

export interface JunctionModel {
  readonly x: number;
  readonly y: number;
  readonly condition: Condition;
}

export interface SwitchModel {
  readonly key: string;
  readonly id: string;
  readonly kind: SwitchKind;
  readonly x: number;
  readonly y: number;
  readonly position: Position;
  readonly condition: Condition;
  readonly symbol: SwitchSymbol | null;
  readonly earthing: EarthingSymbol | null;
  readonly shortName: string;
  readonly labelX: number;
  readonly labelY: number;
  readonly labelAnchor: 'start' | 'end';
  readonly targetPosition: Position;
  readonly touches: readonly string[];
  readonly selection: Selection;
  readonly ariaLabel: string;
  readonly selected: boolean;
  readonly hovered: boolean;
}

export interface BusbarModel {
  readonly key: string;
  readonly node: string;
  readonly bus: number;
  readonly name: string;
  readonly y: number;
  readonly x1: number;
  readonly x2: number;
  readonly condition: Condition;
  readonly selection: Selection;
  readonly ariaLabel: string;
  readonly selected: boolean;
  readonly hovered: boolean;
}

export interface TerminalModel {
  readonly key: string;
  readonly bay: string;
  readonly x: number;
  readonly y: number;
  readonly symbol: TerminalSymbol;
  readonly condition: Condition;
  readonly readout: readonly string[];
  readonly overloaded: boolean;
  readonly selection: Selection;
  readonly ariaLabel: string;
  readonly selected: boolean;
  readonly hovered: boolean;
}

export interface CaptionModel {
  readonly bay: string;
  readonly x: number;
  readonly y: number;
  readonly lines: readonly string[];
  readonly status: string;
}

export interface SldModel {
  readonly width: number;
  readonly height: number;
  readonly wires: readonly WireModel[];
  readonly junctions: readonly JunctionModel[];
  readonly busbars: readonly BusbarModel[];
  readonly switches: readonly SwitchModel[];
  readonly terminals: readonly TerminalModel[];
  readonly captions: readonly CaptionModel[];
  readonly items: readonly NavItem[];
}

const KIND_NAMES: Record<SwitchKind, string> = {
  BREAKER: 'Breaker',
  DISCONNECTOR: 'Disconnector',
  EARTHING_SWITCH: 'Earthing switch',
};

const CONDITION_TEXT: Record<Condition, string> = {
  ENERGIZED: 'energized',
  DEENERGIZED: 'de-energized',
  EARTHED: 'earthed',
};

const EARTH_NODE = 'EARTH';
const TERMINAL_HIT_HALF_WIDTH = 14;

export function conditionText(condition: Condition): string {
  return CONDITION_TEXT[condition];
}

function conditionOf(states: ReadonlyMap<string, NodeCondition>, node: string): Condition {
  return states.get(node) ?? 'DEENERGIZED';
}

function switchCondition(states: ReadonlyMap<string, NodeCondition>, entry: SldSwitch): Condition {
  const node = entry.nodeA === EARTH_NODE ? entry.nodeB : entry.nodeA;
  return conditionOf(states, node);
}

function switchModel(entry: SldSwitch, input: SldInput): SwitchModel {
  const position = input.positions.get(entry.id) ?? initialPosition(input.substation, entry.id);
  const condition = switchCondition(input.nodeStates, entry);
  const target = oppositePosition(position);
  const verb = target === 'OPEN' ? 'open' : 'close';
  const selection: Selection = { kind: 'switch', id: entry.id };
  const operation = input.operable ? ` Press Enter to ${verb} it.` : '';
  return {
    key: `switch:${entry.id}`,
    id: entry.id,
    kind: entry.kind,
    x: entry.x,
    y: entry.y,
    position,
    condition,
    symbol: entry.kind === 'EARTHING_SWITCH' ? null : switchSymbol(entry.kind, position),
    earthing: entry.kind === 'EARTHING_SWITCH' ? earthingSymbol(position) : null,
    shortName: entry.shortName,
    labelX: entry.labelAt.x,
    labelY: entry.labelAt.y,
    labelAnchor: entry.labelAnchor,
    targetPosition: target,
    touches: [entry.nodeA, entry.nodeB],
    selection,
    ariaLabel: `${KIND_NAMES[entry.kind]} ${entry.shortName}, ${entry.bayName}, ${positionLabel(position).toLowerCase()}, ${conditionText(condition)}.${operation}`,
    selected: sameSelection(input.selection, selection),
    hovered: sameSelection(input.hover, selection),
  };
}

function initialPosition(substation: Substation, id: string): Position {
  return substation.switches.find((entry) => entry.id === id)?.initialPosition ?? 'OPEN';
}

function busbarModel(entry: SldBusbar, input: SldInput): BusbarModel {
  const bus = input.buses.has(entry.bus) ? entry.bus : input.substation.bus;
  const selection: Selection = { kind: 'bus', id: String(bus) };
  const condition = conditionOf(input.nodeStates, entry.node);
  return {
    key: `busbar:${entry.node}`,
    node: entry.node,
    bus,
    name: entry.name,
    y: entry.y,
    x1: entry.x1,
    x2: entry.x2,
    condition,
    selection,
    ariaLabel: `${entry.name}, bus ${entry.bus}, ${conditionText(condition)}.`,
    selected: sameSelection(input.selection, selection),
    hovered: sameSelection(input.hover, selection),
  };
}

function substationBuses(input: SldInput): BusState[] {
  const present = input.layout.busbars.flatMap((busbar) => input.buses.get(busbar.bus) ?? []);
  const fallback = input.buses.get(input.substation.bus);
  return present.length > 0 ? present : fallback === undefined ? [] : [fallback];
}

function branchReadout(branch: BranchState, buses: readonly BusState[]): readonly string[] {
  if (!branch.inService) {
    return ['out of service'];
  }
  if (!branch.energized) {
    return ['de-energized'];
  }
  const inside = buses.some((bus) => bus.number === branch.from);
  const leavingMw = inside ? branch.activeFromMw : branch.activeToMw;
  const direction = leavingMw >= 0 ? 'out' : 'in';
  return [`${direction} ${formatMw(Math.abs(leavingMw))}`, formatPercent(branch.loading, 0)];
}

function terminalLabel(entry: SldTerminal, transformer: boolean): string {
  if (entry.kind === 'LOAD') {
    return `Load feeder ${entry.bay}`;
  }
  if (entry.kind === 'GENERATOR') {
    return `Generator feeder ${entry.bay}`;
  }
  return `${transformer ? 'Transformer' : 'Line'} ${entry.equipment}`;
}

function terminalModel(entry: SldTerminal, input: SldInput): TerminalModel {
  const branch = entry.kind === 'BRANCH' ? (input.branches.get(entry.equipment) ?? null) : null;
  const buses = substationBuses(input);
  const loadBus = buses.reduce<BusState | null>(
    (best, bus) => (best === null || bus.activeLoadMw > best.activeLoadMw ? bus : best),
    null,
  );
  const transformer = input.transformers.has(entry.equipment);
  const condition =
    branch !== null && !branch.energized
      ? 'DEENERGIZED'
      : conditionOf(input.nodeStates, entry.node);
  const selection: Selection =
    entry.kind === 'BRANCH'
      ? { kind: 'branch', id: entry.equipment }
      : { kind: 'bus', id: String(loadBus?.number ?? input.substation.bus) };
  const readout =
    branch !== null
      ? branchReadout(branch, buses)
      : entry.kind === 'LOAD' && loadBus !== null
        ? [formatMw(buses.reduce((sum, bus) => sum + bus.activeLoadMw, 0))]
        : [];
  const overloaded = branch?.overloaded ?? false;
  return {
    key: `terminal:${entry.bay}`,
    bay: entry.bay,
    x: entry.x,
    y: entry.y,
    symbol: terminalSymbol(entry.kind, transformer),
    condition,
    readout,
    overloaded,
    selection,
    ariaLabel: `${terminalLabel(entry, transformer)}, ${conditionText(condition)}${readout.length > 0 ? `, ${readout.join(', ')}` : ''}${overloaded ? ', overloaded' : ''}.`,
    selected: sameSelection(input.selection, selection),
    hovered: sameSelection(input.hover, selection),
  };
}

function navItems(
  switches: readonly SwitchModel[],
  busbars: readonly BusbarModel[],
  terminals: readonly TerminalModel[],
): NavItem[] {
  return [
    ...busbars.map((entry) => ({
      id: entry.key,
      x1: entry.x1,
      x2: entry.x2,
      y1: entry.y - 4,
      y2: entry.y + 4,
      links: switches
        .filter(
          (candidate) =>
            candidate.kind !== 'EARTHING_SWITCH' && candidate.touches.includes(entry.node),
        )
        .map((candidate) => candidate.key),
    })),
    ...switches.map((entry) => ({
      id: entry.key,
      x1: entry.x - SWITCH_HALF_LENGTH,
      x2: entry.x + SWITCH_HALF_LENGTH,
      y1: entry.y - (entry.kind === 'EARTHING_SWITCH' ? 0 : SWITCH_HALF_LENGTH),
      y2: entry.y + (entry.kind === 'EARTHING_SWITCH' ? 22 : SWITCH_HALF_LENGTH),
    })),
    ...terminals.map((entry) => ({
      id: entry.key,
      x1: entry.x - TERMINAL_HIT_HALF_WIDTH,
      x2: entry.x + TERMINAL_HIT_HALF_WIDTH,
      y1: entry.y,
      y2: entry.y + TERMINAL_LENGTH,
    })),
  ];
}

export function buildSldModel(input: SldInput): SldModel {
  const { layout, nodeStates } = input;
  const switches = layout.switches.map((entry) => switchModel(entry, input));
  const busbars = layout.busbars.map((entry) => busbarModel(entry, input));
  const terminals = layout.terminals.map((entry) => terminalModel(entry, input));
  return {
    width: layout.width,
    height: layout.height,
    wires: layout.wires.map((wire) => ({
      id: wire.id,
      d: wire.d,
      condition: conditionOf(nodeStates, wire.node),
    })),
    junctions: layout.junctions.map((junction) => ({
      x: junction.x,
      y: junction.y,
      condition: conditionOf(nodeStates, junction.node),
    })),
    busbars,
    switches,
    terminals,
    captions: layout.captions.map((caption) => ({
      bay: caption.bay,
      x: caption.x,
      y: caption.y,
      lines: caption.lines,
      status: conditionText(conditionOf(nodeStates, caption.statusNode)),
    })),
    items: navItems(switches, busbars, terminals),
  };
}

export interface SldEntry {
  readonly selection: Selection;
  readonly switchId: string | null;
  readonly targetPosition: Position | null;
}

export function entryFor(key: string, model: SldModel): SldEntry | null {
  const entry =
    model.switches.find((candidate) => candidate.key === key) ??
    model.busbars.find((candidate) => candidate.key === key) ??
    model.terminals.find((candidate) => candidate.key === key) ??
    null;
  if (entry === null) {
    return null;
  }
  const operable = 'targetPosition' in entry;
  return {
    selection: entry.selection,
    switchId: operable ? entry.id : null,
    targetPosition: operable ? entry.targetPosition : null,
  };
}
