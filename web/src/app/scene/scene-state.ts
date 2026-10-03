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
import { busbarEquipmentId, terminalEquipmentId } from './scene-plan';
import type { ScenePlan } from './scene-plan';

export type EquipmentKind = 'switch' | 'busbar' | 'terminal';

export type LabelTone = 'energized' | 'deenergized' | 'earthed' | 'alarm';

export interface EquipmentState {
  readonly id: string;
  readonly kind: EquipmentKind;
  readonly switchKind: SwitchKind | null;
  readonly position: Position | null;
  readonly condition: NodeCondition;
  readonly overloaded: boolean;
  readonly selection: Selection;
  readonly switchId: string | null;
  readonly targetPosition: Position | null;
  readonly selected: boolean;
  readonly hovered: boolean;
  readonly description: string;
}

export interface ConductorState {
  readonly condition: NodeCondition;
  readonly overloaded: boolean;
  readonly selected: boolean;
  readonly hovered: boolean;
}

export interface LabelState {
  readonly lines: readonly string[];
  readonly tone: LabelTone;
}

export interface SceneState {
  readonly equipment: ReadonlyMap<string, EquipmentState>;
  readonly conductors: readonly ConductorState[];
  readonly bayLabels: ReadonlyMap<string, LabelState>;
  readonly busbarLabels: ReadonlyMap<string, LabelState>;
}

export interface SceneStateInput {
  readonly plan: ScenePlan;
  readonly substation: Substation;
  readonly nodeStates: ReadonlyMap<string, NodeCondition>;
  readonly positions: ReadonlyMap<string, Position>;
  readonly branches: ReadonlyMap<string, BranchState>;
  readonly buses: ReadonlyMap<number, BusState>;
  readonly selection: Selection | null;
  readonly hover: Selection | null;
  readonly operable: boolean;
}

const KIND_NAMES: Record<SwitchKind, string> = {
  BREAKER: 'Breaker',
  DISCONNECTOR: 'Disconnector',
  EARTHING_SWITCH: 'Earthing switch',
};

const CONDITION_TEXT: Record<NodeCondition, string> = {
  ENERGIZED: 'energized',
  DEENERGIZED: 'de-energized',
  EARTHED: 'earthed',
};

export function conditionWord(condition: NodeCondition): string {
  return CONDITION_TEXT[condition];
}

function conditionOf(states: ReadonlyMap<string, NodeCondition>, node: string): NodeCondition {
  return states.get(node) ?? 'DEENERGIZED';
}

function toneOf(condition: NodeCondition, overloaded: boolean): LabelTone {
  if (overloaded) {
    return 'alarm';
  }
  return condition === 'ENERGIZED'
    ? 'energized'
    : condition === 'EARTHED'
      ? 'earthed'
      : 'deenergized';
}

function substationBuses(input: SceneStateInput): BusState[] {
  const present = input.plan.busbars.flatMap((busbar) => input.buses.get(busbar.bus) ?? []);
  const fallback = input.buses.get(input.substation.bus);
  return present.length > 0 ? present : fallback === undefined ? [] : [fallback];
}

function branchReadout(branch: BranchState, buses: readonly BusState[]): string {
  if (!branch.inService) {
    return 'out of service';
  }
  if (!branch.energized) {
    return 'de-energized';
  }
  const inside = buses.some((bus) => bus.number === branch.from);
  const leavingMw = inside ? branch.activeFromMw : branch.activeToMw;
  const direction = leavingMw >= 0 ? 'out' : 'in';
  return `${direction} ${formatMw(Math.abs(leavingMw))}, ${formatPercent(branch.loading, 0)}`;
}

function switchEntry(plan: ScenePlan['switches'][number], input: SceneStateInput): EquipmentState {
  const description = input.substation.switches.find((entry) => entry.id === plan.id);
  const position = input.positions.get(plan.id) ?? description?.initialPosition ?? 'OPEN';
  const condition = conditionOf(input.nodeStates, plan.conditionNode);
  const target = oppositePosition(position);
  const selection: Selection = { kind: 'switch', id: plan.id };
  const bayName = input.plan.bays.find((bay) => bay.id === plan.bay)?.name ?? plan.bay;
  const verb = target === 'OPEN' ? 'open' : 'close';
  const operation = input.operable ? ` Click to ${verb} it.` : '';
  return {
    id: plan.id,
    kind: 'switch',
    switchKind: plan.kind,
    position,
    condition,
    overloaded: false,
    selection,
    switchId: plan.id,
    targetPosition: target,
    selected: sameSelection(input.selection, selection),
    hovered: sameSelection(input.hover, selection),
    description: `${KIND_NAMES[plan.kind]} ${plan.id}, ${bayName}, ${positionLabel(position).toLowerCase()}, ${conditionWord(condition)}.${operation}`,
  };
}

function busbarEntry(plan: ScenePlan['busbars'][number], input: SceneStateInput): EquipmentState {
  const bus = input.buses.has(plan.bus) ? plan.bus : input.substation.bus;
  const selection: Selection = { kind: 'bus', id: String(bus) };
  const condition = conditionOf(input.nodeStates, plan.node);
  return {
    id: busbarEquipmentId(plan.node),
    kind: 'busbar',
    switchKind: null,
    position: null,
    condition,
    overloaded: false,
    selection,
    switchId: null,
    targetPosition: null,
    selected: sameSelection(input.selection, selection),
    hovered: sameSelection(input.hover, selection),
    description: `${plan.name}, bus ${plan.bus}, ${conditionWord(condition)}.`,
  };
}

function terminalEntry(
  plan: ScenePlan['terminals'][number],
  input: SceneStateInput,
  buses: readonly BusState[],
): EquipmentState {
  const branch = plan.kind === 'BRANCH' ? (input.branches.get(plan.equipment) ?? null) : null;
  const condition =
    branch !== null && !branch.energized ? 'DEENERGIZED' : conditionOf(input.nodeStates, plan.node);
  const loadBus = buses.reduce<BusState | null>(
    (best, bus) => (best === null || bus.activeLoadMw > best.activeLoadMw ? bus : best),
    null,
  );
  const selection: Selection =
    plan.kind === 'BRANCH'
      ? { kind: 'branch', id: plan.equipment }
      : { kind: 'bus', id: String(loadBus?.number ?? input.substation.bus) };
  const overloaded = branch?.overloaded ?? false;
  const subject =
    plan.shape === 'LOAD'
      ? `Load feeder ${plan.bay}`
      : plan.shape === 'GENERATOR'
        ? `Generator feeder ${plan.bay}`
        : `${plan.shape === 'TRANSFORMER' ? 'Transformer' : 'Line'} ${plan.equipment}`;
  return {
    id: terminalEquipmentId(plan.bay),
    kind: 'terminal',
    switchKind: null,
    position: null,
    condition,
    overloaded,
    selection,
    switchId: null,
    targetPosition: null,
    selected: sameSelection(input.selection, selection),
    hovered: sameSelection(input.hover, selection),
    description: `${subject}, ${conditionWord(condition)}${overloaded ? ', overloaded' : ''}.`,
  };
}

function bayLabels(
  input: SceneStateInput,
  equipment: ReadonlyMap<string, EquipmentState>,
  buses: readonly BusState[],
): Map<string, LabelState> {
  const labels = new Map<string, LabelState>();
  input.plan.bays.forEach((bay) => {
    const terminal = input.plan.terminals.find((entry) => entry.bay === bay.id);
    if (terminal === undefined) {
      const breaker = input.plan.switches.find(
        (entry) => entry.bay === bay.id && entry.kind === 'BREAKER',
      );
      const breakerState = breaker === undefined ? undefined : equipment.get(breaker.id);
      const position = breakerState?.position ?? 'OPEN';
      labels.set(bay.id, {
        lines: [bay.name, `breaker ${positionLabel(position).toLowerCase()}`],
        tone: 'energized',
      });
      return;
    }
    const state = equipment.get(terminalEquipmentId(bay.id));
    const condition = state?.condition ?? 'DEENERGIZED';
    const branch = terminal.kind === 'BRANCH' ? input.branches.get(terminal.equipment) : undefined;
    const readout =
      branch === undefined || condition !== 'ENERGIZED' ? [] : [branchReadout(branch, buses)];
    const alarm = state?.overloaded === true;
    labels.set(bay.id, {
      lines: [`${bay.id} ${conditionWord(condition)}${alarm ? ' !' : ''}`, ...readout],
      tone: toneOf(condition, alarm),
    });
  });
  return labels;
}

function conductorStates(
  input: SceneStateInput,
  equipment: ReadonlyMap<string, EquipmentState>,
): ConductorState[] {
  return input.plan.conductors.map((conductor) => {
    const terminal =
      conductor.terminalBay === null
        ? undefined
        : equipment.get(terminalEquipmentId(conductor.terminalBay));
    const busbar =
      conductor.busbarNode === null
        ? undefined
        : equipment.get(busbarEquipmentId(conductor.busbarNode));
    const condition = terminal?.condition ?? conductorCondition(input, conductor.node);
    return {
      condition,
      overloaded: terminal?.overloaded ?? false,
      selected: (terminal ?? busbar)?.selected ?? false,
      hovered: (terminal ?? busbar)?.hovered ?? false,
    };
  });
}

function conductorCondition(input: SceneStateInput, node: string): NodeCondition {
  return conditionOf(input.nodeStates, node);
}

export function buildSceneState(input: SceneStateInput): SceneState {
  const buses = substationBuses(input);
  const entries: EquipmentState[] = [
    ...input.plan.switches.map((plan) => switchEntry(plan, input)),
    ...input.plan.busbars.map((plan) => busbarEntry(plan, input)),
    ...input.plan.terminals.map((plan) => terminalEntry(plan, input, buses)),
  ];
  const equipment = new Map(entries.map((entry) => [entry.id, entry]));
  const busbarLabels = new Map<string, LabelState>(
    input.plan.busbars.map((plan) => {
      const state = equipment.get(busbarEquipmentId(plan.node));
      const condition = state?.condition ?? 'DEENERGIZED';
      return [
        plan.node,
        {
          lines: [plan.name, `bus ${plan.bus}, ${conditionWord(condition)}`],
          tone: toneOf(condition, false),
        },
      ];
    }),
  );
  return {
    equipment,
    conductors: conductorStates(input, equipment),
    bayLabels: bayLabels(input, equipment, buses),
    busbarLabels,
  };
}

export interface EquipmentDescription {
  readonly id: string;
  readonly kind: EquipmentKind;
  readonly position: Position | null;
  readonly condition: NodeCondition;
  readonly selected: boolean;
  readonly hovered: boolean;
}

export function describeEquipment(state: SceneState | null): EquipmentDescription[] {
  if (state === null) {
    return [];
  }
  return [...state.equipment.values()].map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    position: entry.position,
    condition: entry.condition,
    selected: entry.selected,
    hovered: entry.hovered,
  }));
}

const PALETTE: Record<NodeCondition, number> = {
  ENERGIZED: 0x4aa3ff,
  DEENERGIZED: 0x808792,
  EARTHED: 0xb07be0,
};

export const ALARM_COLOUR = 0xe5483a;
export const SELECTION_COLOUR = 0xffbf3f;
const WHITE = 0xffffff;

export function mixColours(from: number, to: number, amount: number): number {
  const channel = (shift: number): number => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * amount);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function conductorColour(state: {
  readonly condition: NodeCondition;
  readonly overloaded: boolean;
  readonly selected: boolean;
  readonly hovered: boolean;
}): number {
  const base = state.overloaded ? ALARM_COLOUR : PALETTE[state.condition];
  if (state.selected) {
    return mixColours(base, SELECTION_COLOUR, 0.55);
  }
  return state.hovered ? mixColours(base, WHITE, 0.4) : base;
}

export function bladeAngle(position: Position | null, openAngle: number): number {
  return position === 'OPEN' ? openAngle : 0;
}
