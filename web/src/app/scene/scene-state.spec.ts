import type { BranchState, BusState, NodeCondition, Position } from '../model/api-types';
import { branchSelection, busSelection, switchSelection } from '../model/selection';
import type { Selection } from '../model/selection';
import { branchState, busState } from '../testing/fixtures';
import { allSwitchPositions, fullSubstation } from '../testing/substation-fixture';
import { buildScenePlan } from './scene-plan';
import {
  ALARM_COLOUR,
  SELECTION_COLOUR,
  bladeAngle,
  buildSceneState,
  conductorColour,
  conditionWord,
  describeEquipment,
  mixColours,
} from './scene-state';
import type { SceneState } from './scene-state';

interface Overrides {
  readonly nodes?: Record<string, NodeCondition>;
  readonly positions?: Record<string, Position>;
  readonly branches?: BranchState[];
  readonly buses?: BusState[];
  readonly selection?: Selection | null;
  readonly hover?: Selection | null;
  readonly operable?: boolean;
}

function stateWith(overrides: Overrides = {}): SceneState {
  const substation = fullSubstation();
  const plan = buildScenePlan(substation, new Set(['T4-7']));
  const positions = allSwitchPositions(substation);
  Object.entries(overrides.positions ?? {}).forEach(([id, position]) => {
    positions.set(id, position);
  });
  const nodeStates = new Map<string, NodeCondition>(
    substation.nodes.map((node) => [node, overrides.nodes?.[node] ?? 'ENERGIZED']),
  );
  const buses = overrides.buses ?? [
    busState({ number: 4, activeLoadMw: 0 }),
    busState({ number: 40, activeLoadMw: 47.8 }),
  ];
  const branches = overrides.branches ?? [
    branchState({
      id: 'L2-4',
      from: 2,
      to: 4,
      activeFromMw: 30.6,
      activeToMw: -30.4,
      loading: 0.75,
    }),
    branchState({
      id: 'T4-7',
      from: 4,
      to: 7,
      activeFromMw: 28.1,
      activeToMw: -28.1,
      loading: 0.76,
    }),
  ];
  return buildSceneState({
    plan,
    substation,
    nodeStates,
    positions,
    branches: new Map(branches.map((entry) => [entry.id, entry])),
    buses: new Map(buses.map((entry) => [entry.number, entry])),
    selection: overrides.selection ?? null,
    hover: overrides.hover ?? null,
    operable: overrides.operable ?? true,
  });
}

function entry(state: SceneState, id: string) {
  const found = state.equipment.get(id);
  if (found === undefined) {
    throw new Error(`no equipment ${id}`);
  }
  return found;
}

describe('buildSceneState', () => {
  it('describes every switch with its position, condition and target', () => {
    const state = stateWith({
      positions: { 'L3-4.QA1': 'OPEN' },
      nodes: { 'L3-4.A': 'DEENERGIZED' },
    });
    const breaker = entry(state, 'L3-4.QA1');
    expect(breaker.kind).toBe('switch');
    expect(breaker.switchKind).toBe('BREAKER');
    expect(breaker.position).toBe('OPEN');
    expect(breaker.targetPosition).toBe('CLOSED');
    expect(breaker.condition).toBe('DEENERGIZED');
    expect(breaker.switchId).toBe('L3-4.QA1');
    expect(breaker.description).toContain('Breaker L3-4.QA1');
    expect(breaker.description).toContain('open');
    expect(breaker.description).toContain('Click to close it.');
  });

  it('leaves out the invitation to click when the view is not operable', () => {
    const state = stateWith({ operable: false });
    expect(entry(state, 'L3-4.QA1').description).not.toContain('Click to');
  });

  it('reads the earthing switch condition from the node it grounds', () => {
    const state = stateWith({
      positions: { 'CPL.QE1': 'CLOSED' },
      nodes: { 'CPL.A': 'EARTHED' },
    });
    const earthing = entry(state, 'CPL.QE1');
    expect(earthing.condition).toBe('EARTHED');
    expect(earthing.description).toContain('earthed');
    expect(earthing.targetPosition).toBe('OPEN');
  });

  it('falls back to the initial position and a de-energized node', () => {
    const substation = fullSubstation();
    const plan = buildScenePlan(substation);
    const state = buildSceneState({
      plan,
      substation,
      nodeStates: new Map(),
      positions: new Map(),
      branches: new Map(),
      buses: new Map(),
      selection: null,
      hover: null,
      operable: true,
    });
    expect(entry(state, 'L3-4.QB2').position).toBe('OPEN');
    expect(entry(state, 'L3-4.QB1').position).toBe('CLOSED');
    expect(entry(state, 'L3-4.QB1').condition).toBe('DEENERGIZED');
  });

  it('maps a busbar to the bus selection and the second busbar to bus 40', () => {
    const state = stateWith();
    expect(entry(state, 'busbar:BB1').selection).toEqual(busSelection(4));
    expect(entry(state, 'busbar:BB2').selection).toEqual(busSelection(40));
  });

  it('maps a busbar to the substation bus while the buses are merged', () => {
    const state = stateWith({ buses: [busState({ number: 4 })] });
    expect(entry(state, 'busbar:BB2').selection).toEqual(busSelection(4));
  });

  it('maps a line terminal to its branch and a load terminal to the busiest load bus', () => {
    const state = stateWith();
    expect(entry(state, 'terminal:L2-4').selection).toEqual(branchSelection('L2-4'));
    expect(entry(state, 'terminal:LOAD').selection).toEqual(busSelection(40));
    expect(entry(state, 'terminal:T4-7').description).toContain('Transformer T4-7');
    expect(entry(state, 'terminal:L2-4').description).toContain('Line L2-4');
    expect(entry(state, 'terminal:LOAD').description).toContain('Load feeder LOAD');
  });

  it('shows a terminal as de-energized when its branch is', () => {
    const state = stateWith({
      branches: [branchState({ id: 'L2-4', from: 2, to: 4, energized: false })],
    });
    expect(entry(state, 'terminal:L2-4').condition).toBe('DEENERGIZED');
  });

  it('flags an overloaded terminal and writes it into the label', () => {
    const state = stateWith({
      branches: [branchState({ id: 'L2-4', from: 2, to: 4, loading: 1.14, overloaded: true })],
    });
    expect(entry(state, 'terminal:L2-4').overloaded).toBe(true);
    expect(entry(state, 'terminal:L2-4').description).toContain('overloaded');
    expect(state.bayLabels.get('L2-4')?.tone).toBe('alarm');
    expect(state.bayLabels.get('L2-4')?.lines[0]).toContain('!');
  });

  it('marks selected and hovered equipment', () => {
    const state = stateWith({
      selection: switchSelection('L3-4.QA1'),
      hover: branchSelection('L2-4'),
    });
    expect(entry(state, 'L3-4.QA1').selected).toBe(true);
    expect(entry(state, 'L3-4.QA1').hovered).toBe(false);
    expect(entry(state, 'terminal:L2-4').hovered).toBe(true);
    expect(entry(state, 'L3-4.QB1').selected).toBe(false);
  });

  it('writes the loading and the direction into the bay labels', () => {
    const state = stateWith();
    const incoming = state.bayLabels.get('L2-4');
    const outgoing = state.bayLabels.get('T4-7');
    expect(incoming?.lines[0]).toBe('L2-4 energized');
    expect(incoming?.lines[1]).toBe('in 30.4 MW, 75%');
    expect(outgoing?.lines[1]).toBe('out 28.1 MW, 76%');
    expect(incoming?.tone).toBe('energized');
  });

  it('writes out of service and de-energized readouts', () => {
    const outOfService = stateWith({
      branches: [branchState({ id: 'L2-4', from: 2, to: 4, inService: false, energized: false })],
      nodes: { 'L2-4.T': 'DEENERGIZED' },
    });
    expect(outOfService.bayLabels.get('L2-4')?.lines).toEqual(['L2-4 de-energized']);
    expect(outOfService.bayLabels.get('L2-4')?.tone).toBe('deenergized');
    const dead = stateWith({
      branches: [branchState({ id: 'L2-4', from: 2, to: 4, energized: false })],
    });
    expect(dead.bayLabels.get('L2-4')?.lines).toEqual(['L2-4 de-energized']);
  });

  it('labels the coupler with the breaker position', () => {
    expect(stateWith().bayLabels.get('CPL')?.lines).toEqual(['Bus coupler', 'breaker closed']);
    expect(stateWith({ positions: { 'CPL.QA1': 'OPEN' } }).bayLabels.get('CPL')?.lines[1]).toBe(
      'breaker open',
    );
  });

  it('labels the busbars with their bus and condition', () => {
    const state = stateWith({ nodes: { BB2: 'DEENERGIZED' } });
    expect(state.busbarLabels.get('BB1')).toEqual({
      lines: ['Busbar 1', 'bus 4, energized'],
      tone: 'energized',
    });
    expect(state.busbarLabels.get('BB2')?.tone).toBe('deenergized');
  });

  it('colours a conductor from its node, a terminal conductor from its terminal', () => {
    const state = stateWith({
      branches: [branchState({ id: 'L2-4', from: 2, to: 4, loading: 1.2, overloaded: true })],
      selection: busSelection(40),
    });
    const plan = buildScenePlan(fullSubstation(), new Set(['T4-7']));
    const index = plan.conductors.findIndex((conductor) => conductor.terminalBay === 'L2-4');
    expect(state.conductors[index]?.overloaded).toBe(true);
    const dropper = plan.conductors.findIndex((conductor) => conductor.busbarNode === 'BB2');
    expect(state.conductors[dropper]?.selected).toBe(true);
    const plain = plan.conductors.findIndex(
      (conductor) => conductor.terminalBay === null && conductor.busbarNode === null,
    );
    expect(state.conductors[plain]?.selected).toBe(false);
  });
});

describe('describeEquipment', () => {
  it('returns nothing without a state', () => {
    expect(describeEquipment(null)).toEqual([]);
  });

  it('lists every equipment with the fields the end-to-end tests read', () => {
    const list = describeEquipment(stateWith({ positions: { 'CPL.QA1': 'OPEN' } }));
    const coupler = list.find((item) => item.id === 'CPL.QA1');
    expect(coupler).toEqual({
      id: 'CPL.QA1',
      kind: 'switch',
      position: 'OPEN',
      condition: 'ENERGIZED',
      selected: false,
      hovered: false,
    });
    expect(list.filter((item) => item.kind === 'busbar')).toHaveLength(2);
    expect(list.filter((item) => item.kind === 'terminal')).toHaveLength(5);
  });
});

describe('colours and angles', () => {
  it('names the conditions', () => {
    expect(conditionWord('ENERGIZED')).toBe('energized');
    expect(conditionWord('DEENERGIZED')).toBe('de-energized');
    expect(conditionWord('EARTHED')).toBe('earthed');
  });

  it('mixes colours channel by channel', () => {
    expect(mixColours(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColours(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColours(0x102030, 0x304050, 0.5)).toBe(0x203040);
  });

  it('colours by condition and lets alarm, hover and selection override', () => {
    const base = { overloaded: false, selected: false, hovered: false };
    const energized = conductorColour({ ...base, condition: 'ENERGIZED' });
    const dead = conductorColour({ ...base, condition: 'DEENERGIZED' });
    const earthed = conductorColour({ ...base, condition: 'EARTHED' });
    expect(new Set([energized, dead, earthed]).size).toBe(3);
    expect(conductorColour({ ...base, condition: 'ENERGIZED', overloaded: true })).toBe(
      ALARM_COLOUR,
    );
    const hovered = conductorColour({ ...base, condition: 'ENERGIZED', hovered: true });
    expect(hovered).not.toBe(energized);
    const selected = conductorColour({ ...base, condition: 'ENERGIZED', selected: true });
    expect(selected).toBe(mixColours(energized, SELECTION_COLOUR, 0.55));
  });

  it('opens a blade only for the open position', () => {
    expect(bladeAngle('OPEN', 1)).toBe(1);
    expect(bladeAngle('CLOSED', 1)).toBe(0);
    expect(bladeAngle(null, 1)).toBe(0);
  });
});
