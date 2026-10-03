import type {
  Bay,
  BranchState,
  BusState,
  Position,
  Substation,
  SwitchDescription,
  SwitchKind,
} from '../model/api-types';
import { oppositePosition } from '../shared/format';

export interface SwitchRow {
  readonly id: string;
  readonly kind: SwitchKind;
  readonly kindLabel: string;
  readonly position: Position;
  readonly targetPosition: Position;
  readonly actionLabel: string;
}

export interface SwitchGroup {
  readonly bayId: string;
  readonly bayName: string;
  readonly rows: readonly SwitchRow[];
}

export interface Confirmation {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
}

const KIND_LABELS: Record<SwitchKind, string> = {
  BREAKER: 'Breaker',
  DISCONNECTOR: 'Disconnector',
  EARTHING_SWITCH: 'Earthing switch',
};

const KIND_ORDER: Record<SwitchKind, number> = {
  BREAKER: 0,
  DISCONNECTOR: 1,
  EARTHING_SWITCH: 2,
};

function actionLabel(kind: SwitchKind, target: Position): string {
  const verb = target === 'OPEN' ? 'Open' : 'Close';
  return `${verb} ${KIND_LABELS[kind].toLowerCase()}`;
}

function rowFor(
  description: SwitchDescription,
  positions: ReadonlyMap<string, Position>,
): SwitchRow {
  const position = positions.get(description.id) ?? description.initialPosition;
  const targetPosition = oppositePosition(position);
  return {
    id: description.id,
    kind: description.kind,
    kindLabel: KIND_LABELS[description.kind],
    position,
    targetPosition,
    actionLabel: actionLabel(description.kind, targetPosition),
  };
}

export function switchGroupForBay(
  substation: Substation,
  bay: Bay,
  positions: ReadonlyMap<string, Position>,
): SwitchGroup {
  const rows = substation.switches
    .filter((entry) => entry.bay === bay.id)
    .map((entry) => rowFor(entry, positions))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.id.localeCompare(b.id));
  return { bayId: bay.id, bayName: bay.name, rows };
}

export function switchGroupsForBranch(
  substation: Substation | null | undefined,
  branch: BranchState,
  positions: ReadonlyMap<string, Position>,
): SwitchGroup[] {
  if (!substation) {
    return [];
  }
  return substation.bays
    .filter((bay) => bay.terminal?.kind === 'BRANCH' && bay.terminal.equipment === branch.id)
    .map((bay) => switchGroupForBay(substation, bay, positions));
}

export function switchGroupsForBus(
  substation: Substation | null | undefined,
  bus: BusState,
  positions: ReadonlyMap<string, Position>,
): SwitchGroup[] {
  if (!substation) {
    return [];
  }
  const touchesSubstation = substation.busbars.some((busbar) => busbar.bus === bus.number);
  if (!touchesSubstation) {
    return [];
  }
  return substation.bays
    .filter((bay) => bay.kind === 'COUPLER')
    .map((bay) => switchGroupForBay(substation, bay, positions));
}

export function describeConfirmation(
  substation: Substation | null | undefined,
  switchId: string,
  position: Position,
): Confirmation {
  const description = substation?.switches.find((entry) => entry.id === switchId);
  const bay = substation?.bays.find((entry) => entry.id === description?.bay);
  const kind = description === undefined ? 'switch' : KIND_LABELS[description.kind].toLowerCase();
  const verb = position === 'OPEN' ? 'Open' : 'Close';
  const where = bay === undefined ? '' : ` in bay ${bay.name}`;
  return {
    title: `${verb} ${kind} ${switchId}?`,
    message: `The ${kind} ${switchId}${where} will be ${position === 'OPEN' ? 'opened' : 'closed'}. The power flow is solved again and every view updates. The server refuses the operation when an interlock forbids it.`,
    confirmLabel: `${verb} ${kind}`,
  };
}

export function busPlacement(
  substation: Substation | null | undefined,
  bus: BusState,
): string | null {
  const busbar = substation?.busbars.find((entry) => entry.bus === bus.number);
  return busbar === undefined ? null : busbar.name;
}
