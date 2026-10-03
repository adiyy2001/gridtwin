import type { Bay, Position, Substation, SwitchDescription } from '../model/api-types';

interface FeederSpec {
  readonly id: string;
  readonly name: string;
  readonly column: number;
  readonly terminalKind: 'BRANCH' | 'LOAD';
  readonly onSecondBusbar: boolean;
}

const FEEDERS: readonly FeederSpec[] = [
  { id: 'L2-4', name: 'Line to bus 2', column: 0, terminalKind: 'BRANCH', onSecondBusbar: true },
  { id: 'L3-4', name: 'Line to bus 3', column: 1, terminalKind: 'BRANCH', onSecondBusbar: false },
  { id: 'L4-5', name: 'Line to bus 5', column: 2, terminalKind: 'BRANCH', onSecondBusbar: false },
  {
    id: 'T4-7',
    name: 'Transformer to bus 7',
    column: 4,
    terminalKind: 'BRANCH',
    onSecondBusbar: true,
  },
  { id: 'LOAD', name: 'Load feeder', column: 5, terminalKind: 'LOAD', onSecondBusbar: true },
];

function sw(
  id: string,
  kind: SwitchDescription['kind'],
  bay: string,
  nodeA: string,
  nodeB: string,
  initialPosition: Position,
): SwitchDescription {
  return { id, kind, bay, nodeA, nodeB, initialPosition };
}

function feederSwitches(spec: FeederSpec): SwitchDescription[] {
  const { id } = spec;
  return [
    sw(`${id}.QB1`, 'DISCONNECTOR', id, 'BB1', `${id}.A`, spec.onSecondBusbar ? 'OPEN' : 'CLOSED'),
    sw(`${id}.QB2`, 'DISCONNECTOR', id, 'BB2', `${id}.A`, spec.onSecondBusbar ? 'CLOSED' : 'OPEN'),
    sw(`${id}.QA1`, 'BREAKER', id, `${id}.A`, `${id}.B`, 'CLOSED'),
    sw(`${id}.QB9`, 'DISCONNECTOR', id, `${id}.B`, `${id}.T`, 'CLOSED'),
    sw(`${id}.QE1`, 'EARTHING_SWITCH', id, `${id}.T`, 'EARTH', 'OPEN'),
  ];
}

export function fullSubstation(): Substation {
  const feederBays: Bay[] = FEEDERS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    kind: 'FEEDER',
    column: spec.column,
    terminal: {
      node: `${spec.id}.T`,
      kind: spec.terminalKind,
      equipment: spec.terminalKind === 'BRANCH' ? spec.id : '',
    },
  }));
  const coupler: Bay = { id: 'CPL', name: 'Bus coupler', kind: 'COUPLER', column: 3 };
  const nodes = [
    'BB1',
    'BB2',
    'CPL.A',
    'CPL.B',
    ...FEEDERS.flatMap((spec) => [`${spec.id}.A`, `${spec.id}.B`, `${spec.id}.T`]),
  ];
  return {
    id: 'S4',
    name: 'Substation 4',
    bus: 4,
    baseKv: 132,
    busbars: [
      { node: 'BB1', bus: 4, name: 'Busbar 1', row: 0 },
      { node: 'BB2', bus: 40, name: 'Busbar 2', row: 1 },
    ],
    nodes,
    bays: [...feederBays, coupler],
    switches: [
      ...FEEDERS.flatMap(feederSwitches),
      sw('CPL.QB1', 'DISCONNECTOR', 'CPL', 'BB1', 'CPL.A', 'CLOSED'),
      sw('CPL.QA1', 'BREAKER', 'CPL', 'CPL.A', 'CPL.B', 'CLOSED'),
      sw('CPL.QB2', 'DISCONNECTOR', 'CPL', 'CPL.B', 'BB2', 'CLOSED'),
      sw('CPL.QE1', 'EARTHING_SWITCH', 'CPL', 'CPL.A', 'EARTH', 'OPEN'),
      sw('CPL.QE2', 'EARTHING_SWITCH', 'CPL', 'CPL.B', 'EARTH', 'OPEN'),
    ],
  };
}

export function allSwitchPositions(substation: Substation): Map<string, Position> {
  return new Map(substation.switches.map((entry) => [entry.id, entry.initialPosition]));
}
