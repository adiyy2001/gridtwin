import { branchState, busState } from '../testing/fixtures';
import { allSwitchPositions, fullSubstation } from '../testing/substation-fixture';
import type { NodeCondition, Position } from '../model/api-types';
import type { Selection } from '../model/selection';
import { buildSldLayout } from './layout';
import { buildSldModel, conditionText, entryFor } from './state-model';
import type { SldInput, SldModel } from './state-model';

const substation = fullSubstation();
const layout = buildSldLayout(substation);

function nodeStates(overrides: Record<string, NodeCondition> = {}): Map<string, NodeCondition> {
  const base = new Map<string, NodeCondition>(substation.nodes.map((node) => [node, 'ENERGIZED']));
  Object.entries(overrides).forEach(([node, state]) => base.set(node, state));
  return base;
}

function input(overrides: Partial<SldInput> = {}): SldInput {
  return {
    layout,
    substation,
    nodeStates: nodeStates(),
    positions: allSwitchPositions(substation),
    branches: new Map([
      [
        'L2-4',
        branchState({
          id: 'L2-4',
          from: 2,
          to: 4,
          loading: 0.5,
          activeFromMw: 40,
          activeToMw: -39,
        }),
      ],
      [
        'L3-4',
        branchState({ id: 'L3-4', from: 3, to: 4, loading: 1.2, overloaded: true, activeToMw: 60 }),
      ],
      ['L4-5', branchState({ id: 'L4-5', from: 4, to: 5, energized: false })],
    ]),
    transformers: new Set(['T4-7']),
    substationBus: busState({ number: 4, activeLoadMw: 47.8 }),
    selection: null,
    hover: null,
    operable: true,
    ...overrides,
  };
}

function model(overrides: Partial<SldInput> = {}): SldModel {
  return buildSldModel(input(overrides));
}

function switchOf(built: SldModel, id: string): SldModel['switches'][number] {
  const found = built.switches.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`no switch ${id}`);
  }
  return found;
}

describe('buildSldModel', () => {
  it('takes positions from the state and offers the opposite operation', () => {
    const built = model();
    expect(switchOf(built, 'L2-4.QA1').position).toBe('CLOSED');
    expect(switchOf(built, 'L2-4.QA1').targetPosition).toBe('OPEN');
    expect(switchOf(built, 'L2-4.QB1').targetPosition).toBe('CLOSED');
  });

  it('prefers the live position over the description', () => {
    const positions = new Map<string, Position>([['L2-4.QA1', 'OPEN']]);
    expect(switchOf(model({ positions }), 'L2-4.QA1').position).toBe('OPEN');
  });

  it('falls back to the description when the state has no entry', () => {
    const built = model({ positions: new Map() });
    expect(switchOf(built, 'L2-4.QB1').position).toBe('OPEN');
  });

  it('draws breakers and disconnectors with a symbol and earthing switches with a ground', () => {
    const built = model();
    expect(switchOf(built, 'L2-4.QA1').symbol).not.toBeNull();
    expect(switchOf(built, 'L2-4.QA1').earthing).toBeNull();
    expect(switchOf(built, 'L2-4.QE1').earthing).not.toBeNull();
    expect(switchOf(built, 'L2-4.QE1').symbol).toBeNull();
  });

  it('colours wires and switches by the state of their node', () => {
    const built = model({
      nodeStates: nodeStates({ 'L2-4.B': 'DEENERGIZED', 'L2-4.T': 'EARTHED' }),
    });
    const conditions = new Map(built.wires.map((wire) => [wire.id, wire.condition]));
    expect(conditions.get('L2-4.lower-node')).toBe('DEENERGIZED');
    expect(conditions.get('L2-4.terminal-node')).toBe('EARTHED');
    expect(conditions.get('L3-4.lower-node')).toBe('ENERGIZED');
    expect(switchOf(built, 'L2-4.QE1').condition).toBe('EARTHED');
  });

  it('treats a node without a state as de-energized', () => {
    const built = model({ nodeStates: new Map() });
    expect(built.busbars[0]?.condition).toBe('DEENERGIZED');
  });

  it('describes a switch for a screen reader with its operation', () => {
    const label = switchOf(model(), 'L2-4.QA1').ariaLabel;
    expect(label).toBe('Breaker QA1, Line to bus 2, closed, energized. Press Enter to open it.');
  });

  it('leaves the operation out of the label when the view is not operable', () => {
    const label = switchOf(model({ operable: false }), 'L2-4.QB1').ariaLabel;
    expect(label).toBe('Disconnector QB1, Line to bus 2, open, energized.');
  });

  it('describes busbars and terminals', () => {
    const built = model();
    expect(built.busbars[0]?.ariaLabel).toBe('Busbar 1, bus 4, energized.');
    const line = built.terminals.find((entry) => entry.bay === 'L2-4');
    expect(line?.ariaLabel).toBe('Line L2-4, energized, in 39.0 MW, 50%.');
    const transformer = built.terminals.find((entry) => entry.bay === 'T4-7');
    expect(transformer?.ariaLabel).toContain('Transformer T4-7');
    expect(transformer?.symbol.circles).toHaveLength(2);
  });

  it('reads the direction of the power relative to the substation', () => {
    const built = model();
    const readout = (bay: string): string | undefined =>
      built.terminals.find((entry) => entry.bay === bay)?.readout[0];
    expect(readout('L2-4')).toBe('in 39.0 MW');
    expect(readout('L3-4')).toBe('out 60.0 MW');
    const leaving = model({
      branches: new Map([['L4-5', branchState({ id: 'L4-5', from: 4, to: 5, activeFromMw: 25 })]]),
    });
    expect(leaving.terminals.find((entry) => entry.bay === 'L4-5')?.readout[0]).toBe('out 25.0 MW');
  });

  it('flags an overloaded branch with text as well as colour', () => {
    const terminal = model().terminals.find((entry) => entry.bay === 'L3-4');
    expect(terminal?.overloaded).toBe(true);
    expect(terminal?.ariaLabel).toContain('overloaded');
  });

  it('shows de-energized branches in words', () => {
    const terminal = model().terminals.find((entry) => entry.bay === 'L4-5');
    expect(terminal?.readout).toEqual(['de-energized']);
  });

  it('shows the load of the substation bus on the load feeder', () => {
    const terminal = model().terminals.find((entry) => entry.bay === 'LOAD');
    expect(terminal?.readout).toEqual(['47.8 MW']);
    expect(terminal?.ariaLabel).toContain('Load feeder LOAD');
  });

  it('shows no readout when there is no state for the equipment', () => {
    const built = model({ branches: new Map(), substationBus: null });
    expect(built.terminals.every((entry) => entry.readout.length === 0)).toBe(true);
  });

  it('marks selection and hover by key', () => {
    const selection: Selection = { kind: 'switch', id: 'L2-4.QA1' };
    const hover: Selection = { kind: 'branch', id: 'L3-4' };
    const built = model({ selection, hover });
    expect(switchOf(built, 'L2-4.QA1').selected).toBe(true);
    expect(switchOf(built, 'L3-4.QA1').selected).toBe(false);
    expect(built.terminals.find((entry) => entry.bay === 'L3-4')?.hovered).toBe(true);
    const busSelected = model({ selection: { kind: 'bus', id: '4' } });
    expect(busSelected.busbars[0]?.selected).toBe(true);
    expect(busSelected.busbars[1]?.selected).toBe(false);
  });

  it('captions every bay with the state of its terminal', () => {
    const built = model({ nodeStates: nodeStates({ 'L2-4.T': 'DEENERGIZED' }) });
    expect(built.captions.find((entry) => entry.bay === 'L2-4')?.status).toBe('de-energized');
    expect(built.captions.find((entry) => entry.bay === 'L3-4')?.status).toBe('energized');
    expect(built.captions.find((entry) => entry.bay === 'CPL')?.status).toBe('energized');
  });

  it('lists every piece of equipment as a navigation item once', () => {
    const built = model();
    const ids = built.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(2 + substation.switches.length + 5);
    expect(ids).toContain('busbar:BB1');
    expect(ids).toContain('terminal:L2-4');
    expect(ids).toContain('switch:CPL.QA1');
  });

  it('links each busbar to the disconnectors that attach to it', () => {
    const links = (node: string): readonly string[] | undefined =>
      model().items.find((item) => item.id === `busbar:${node}`)?.links;
    expect(links('BB1')).toContain('switch:L3-4.QB1');
    expect(links('BB1')).toContain('switch:CPL.QB1');
    expect(links('BB1')).not.toContain('switch:L2-4.QB2');
    expect(links('BB2')).toContain('switch:L2-4.QB2');
    expect(links('BB2')).toContain('switch:CPL.QB2');
  });
});

describe('entryFor', () => {
  const built = model();

  it('describes the operation of a switch', () => {
    expect(entryFor('switch:L2-4.QA1', built)).toEqual({
      selection: { kind: 'switch', id: 'L2-4.QA1' },
      switchId: 'L2-4.QA1',
      targetPosition: 'OPEN',
    });
  });

  it('selects the bus of a busbar without operating anything', () => {
    expect(entryFor('busbar:BB2', built)).toEqual({
      selection: { kind: 'bus', id: '40' },
      switchId: null,
      targetPosition: null,
    });
  });

  it('selects the branch of a terminal', () => {
    expect(entryFor('terminal:L2-4', built)?.selection).toEqual({ kind: 'branch', id: 'L2-4' });
  });

  it('selects the substation bus for a load feeder', () => {
    expect(entryFor('terminal:LOAD', built)?.selection).toEqual({ kind: 'bus', id: '4' });
  });

  it('returns nothing for an unknown key', () => {
    expect(entryFor('switch:nope', built)).toBeNull();
  });
});

describe('conditionText', () => {
  it('names each condition in words', () => {
    expect(conditionText('ENERGIZED')).toBe('energized');
    expect(conditionText('DEENERGIZED')).toBe('de-energized');
    expect(conditionText('EARTHED')).toBe('earthed');
  });
});
