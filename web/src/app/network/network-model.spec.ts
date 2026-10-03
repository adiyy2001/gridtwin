import { DEENERGIZED_DASH, buildNetworkModel } from './network-model';
import { buildLayout } from './network-layout';
import { branchState, busState, caseDetail, twinState } from '../testing/fixtures';

describe('buildNetworkModel', () => {
  const detail = caseDetail();
  const layout = buildLayout(detail);

  function build(state = twinState(), selection = null, hover = null) {
    return buildNetworkModel(detail, layout, state, selection, hover);
  }

  it('builds one model per branch and bus', () => {
    const model = build();
    expect(model.branches).toHaveLength(2);
    expect(model.buses).toHaveLength(3);
  });

  it('colours a loaded branch and labels it with the loading', () => {
    const branch = build().branches.find((entry) => entry.id === 'L2-4');
    expect(branch?.label).toBe('L2-4 80%');
    expect(branch?.dash).toBeNull();
    expect(branch?.energized).toBe(true);
    expect(branch?.ariaLabel).toContain('loading 80.0%');
  });

  it('marks an overloaded branch in the label, the casing flag and the description', () => {
    const state = twinState({
      branches: [branchState({ id: 'L1-2', loading: 1.14, overloaded: true })],
    });
    const branch = build(state).branches[0];
    expect(branch?.label).toBe('L1-2 114% !');
    expect(branch?.overloaded).toBe(true);
    expect(branch?.band).toBe('overloaded');
    expect(branch?.ariaLabel).toContain('overloaded');
  });

  it('draws a de-energized branch grey and dashed without particles', () => {
    const state = twinState({
      branches: [branchState({ id: 'L1-2', energized: false, loading: 0 })],
    });
    const branch = build(state).branches[0];
    expect(branch?.dash).toBe(DEENERGIZED_DASH);
    expect(branch?.label).toBe('L1-2 off');
    expect(branch?.flow).toBeNull();
    expect(branch?.ariaLabel).toContain('de-energized');
  });

  it('describes a branch that is out of service', () => {
    const state = twinState({
      branches: [branchState({ id: 'L1-2', inService: false, energized: false })],
    });
    expect(build(state).branches[0]?.ariaLabel).toContain('out of service');
  });

  it('gives a live branch a flow with direction, speed and spacing', () => {
    const flow = build().branches.find((entry) => entry.id === 'L2-4')?.flow;
    expect(flow?.direction).toBe(-1);
    expect(flow?.speed).toBeGreaterThan(0);
    expect(flow?.spacing).toBeGreaterThan(0);
  });

  it('skips a branch whose bus has no position', () => {
    const state = twinState({ branches: [branchState({ id: 'X', from: 1, to: 77 })] });
    expect(build(state).branches).toHaveLength(0);
  });

  it('skips a bus that has no position', () => {
    const state = twinState({ buses: [busState({ number: 77 })] });
    expect(build(state).buses).toHaveLength(0);
  });

  it('marks the selected and hovered elements', () => {
    const model = build(
      twinState(),
      { kind: 'branch', id: 'L1-2' } as never,
      { kind: 'bus', id: '2' } as never,
    );
    expect(model.branches.find((entry) => entry.id === 'L1-2')?.selected).toBe(true);
    expect(model.branches.find((entry) => entry.id === 'L2-4')?.selected).toBe(false);
    expect(model.buses.find((entry) => entry.number === 2)?.hovered).toBe(true);
  });

  it('labels a bus with its voltage', () => {
    const bus = build().buses.find((entry) => entry.number === 2);
    expect(bus?.voltageLabel).toBe('1.010 pu');
    expect(bus?.ariaLabel).toContain('1.010 pu');
    expect(bus?.outOfBand).toBe(false);
  });

  it('flags a voltage outside the monitored band', () => {
    const state = twinState({ buses: [busState({ number: 2, voltageMagnitude: 0.85 })] });
    const bus = build(state).buses[0];
    expect(bus?.outOfBand).toBe(true);
    expect(bus?.voltageLabel).toBe('0.850 pu !');
    expect(bus?.ariaLabel).toContain('outside the voltage band');
  });

  it('draws a dead bus grey and dashed', () => {
    const state = twinState({ buses: [busState({ number: 2, state: 'DEENERGIZED' })] });
    const bus = build(state).buses[0];
    expect(bus?.dash).toBe(DEENERGIZED_DASH);
    expect(bus?.voltageLabel).toBe('dead');
    expect(bus?.ariaLabel).toContain('de-energized');
  });

  it('describes a collapsed bus', () => {
    const state = twinState({ buses: [busState({ number: 2, state: 'COLLAPSED' })] });
    const bus = build(state).buses[0];
    expect(bus?.ariaLabel).toContain('voltage collapse');
    expect(bus?.outline).toBe('#7c3aed');
  });

  it('marks buses with generation', () => {
    const model = build();
    expect(model.buses.find((entry) => entry.number === 1)?.hasGeneration).toBe(true);
    expect(model.buses.find((entry) => entry.number === 2)?.hasGeneration).toBe(false);
  });

  it('falls back to a default band for a bus the case does not list', () => {
    const state = twinState({ buses: [busState({ number: 40 })] });
    expect(build(state).buses[0]?.number).toBe(40);
  });
});
