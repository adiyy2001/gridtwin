import type { Substation } from '../model/api-types';
import { fullSubstation } from '../testing/substation-fixture';
import {
  BAY_HEIGHT,
  BAY_SPACING,
  BUSBAR_HEIGHT,
  BUSBAR_SPACING,
  busbarEquipmentId,
  buildScenePlan,
  planCenter,
  terminalEquipmentId,
} from './scene-plan';
import type { ScenePlan, SwitchPlan } from './scene-plan';

function plan(substation: Substation = fullSubstation(), transformers: string[] = []): ScenePlan {
  return buildScenePlan(substation, new Set(transformers));
}

function switchOf(scenePlan: ScenePlan, id: string): SwitchPlan {
  const found = scenePlan.switches.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`no switch ${id}`);
  }
  return found;
}

describe('buildScenePlan', () => {
  it('plans every switch of the description once', () => {
    const substation = fullSubstation();
    const scenePlan = plan(substation);
    expect(scenePlan.switches.map((entry) => entry.id).sort()).toEqual(
      substation.switches.map((entry) => entry.id).sort(),
    );
  });

  it('places the busbars in row order, centred on zero', () => {
    const [first, second] = plan().busbars;
    expect(first?.node).toBe('BB1');
    expect(second?.node).toBe('BB2');
    expect(first?.from.z).toBe(-BUSBAR_SPACING / 2);
    expect(second?.from.z).toBe(BUSBAR_SPACING / 2);
    expect(first?.from.y).toBe(BUSBAR_HEIGHT);
    expect(first?.from.x).toBeLessThan(first?.to.x ?? 0);
  });

  it('spaces the bays by their column and centres them', () => {
    const bays = plan().bays;
    const xs = bays.map((bay) => bay.x).sort((a, b) => a - b);
    expect(xs).toHaveLength(6);
    xs.slice(1).forEach((x, index) => {
      expect((x - (xs[index] ?? 0)) % BAY_SPACING).toBeCloseTo(0);
    });
    expect((xs[0] ?? 0) + (xs[xs.length - 1] ?? 0)).toBeCloseTo(0);
  });

  it('keeps every busbar span wider than the bays', () => {
    const scenePlan = plan();
    const xs = scenePlan.bays.map((bay) => bay.x);
    scenePlan.busbars.forEach((busbar) => {
      expect(busbar.from.x).toBeLessThan(Math.min(...xs));
      expect(busbar.to.x).toBeGreaterThan(Math.max(...xs));
    });
  });

  it('gives each equipment a hit box with a unique id', () => {
    const scenePlan = plan();
    const ids = scenePlan.hits.map((hit) => hit.id);
    expect(new Set(ids).size).toBe(ids.length);
    scenePlan.switches.forEach((entry) => {
      expect(ids).toContain(entry.id);
    });
    scenePlan.busbars.forEach((entry) => {
      expect(ids).toContain(busbarEquipmentId(entry.node));
    });
    scenePlan.terminals.forEach((entry) => {
      expect(ids).toContain(terminalEquipmentId(entry.bay));
    });
    scenePlan.hits.forEach((hit) => {
      expect(hit.size.x).toBeGreaterThan(0);
      expect(hit.size.y).toBeGreaterThan(0);
      expect(hit.size.z).toBeGreaterThan(0);
    });
  });

  it('draws bus disconnectors upright under their busbar and swings them away from the bay', () => {
    const scenePlan = plan();
    const first = switchOf(scenePlan, 'L3-4.QB1');
    const second = switchOf(scenePlan, 'L3-4.QB2');
    expect(first.hinge.y).toBe(BAY_HEIGHT);
    expect(first.contact.y).toBeGreaterThan(first.hinge.y);
    expect(first.contact.y).toBeLessThan(BUSBAR_HEIGHT);
    expect(first.hinge.z).toBeCloseTo(-BUSBAR_SPACING / 2);
    expect(second.hinge.z).toBeCloseTo(BUSBAR_SPACING / 2);
    expect(first.swing.z).toBe(-1);
    expect(second.swing.z).toBe(1);
  });

  it('lays the breaker and the line disconnector along the bay in order', () => {
    const scenePlan = plan();
    const breaker = switchOf(scenePlan, 'L3-4.QA1');
    const lineDisconnector = switchOf(scenePlan, 'L3-4.QB9');
    expect(breaker.contact.z).toBeGreaterThan(breaker.hinge.z);
    expect(lineDisconnector.hinge.z).toBeGreaterThan(breaker.contact.z);
    expect(breaker.swing).toEqual({ x: 0, y: 1, z: 0 });
    expect(breaker.thickness).toBeGreaterThan(lineDisconnector.thickness);
  });

  it('hangs earthing switches from the ground and swings them outwards', () => {
    const earthing = switchOf(plan(), 'L3-4.QE1');
    expect(earthing.hinge.y).toBeLessThan(2);
    expect(earthing.contact.y).toBeGreaterThan(3);
    expect(earthing.swing).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('puts the coupler between the busbars with both earthing switches', () => {
    const scenePlan = plan();
    const breaker = switchOf(scenePlan, 'CPL.QA1');
    const first = switchOf(scenePlan, 'CPL.QB1');
    const last = switchOf(scenePlan, 'CPL.QB2');
    const busbarZ = BUSBAR_SPACING / 2;
    expect(breaker.hinge.z).toBeGreaterThan(-busbarZ);
    expect(breaker.contact.z).toBeLessThan(busbarZ);
    expect(first.contact.z).toBeLessThan(breaker.hinge.z);
    expect(last.hinge.z).toBeGreaterThan(breaker.contact.z);
    const earthingZ = ['CPL.QE1', 'CPL.QE2'].map((id) => switchOf(scenePlan, id).hinge.z);
    expect(earthingZ[0]).toBeLessThan(0);
    expect(earthingZ[1]).toBeGreaterThan(0);
  });

  it('covers every node of a feeder bay with conductors', () => {
    const scenePlan = plan();
    const nodes = new Set(scenePlan.conductors.map((conductor) => conductor.node));
    ['L3-4.A', 'L3-4.B', 'L3-4.T', 'CPL.A', 'CPL.B', 'BB1', 'BB2'].forEach((node) => {
      expect(nodes.has(node)).toBe(true);
    });
    expect(new Set(scenePlan.conductors.map((conductor) => conductor.id)).size).toBe(
      scenePlan.conductors.length,
    );
  });

  it('marks the conductors beyond the gantry as terminal conductors', () => {
    const scenePlan = plan();
    const terminalBays = new Set(
      scenePlan.conductors.flatMap((conductor) =>
        conductor.terminalBay === null ? [] : [conductor.terminalBay],
      ),
    );
    expect([...terminalBays].sort()).toEqual(['L2-4', 'L3-4', 'L4-5', 'LOAD', 'T4-7']);
  });

  it('links the droppers to the busbar they hang from', () => {
    const scenePlan = plan();
    const droppers = scenePlan.conductors.filter((conductor) => conductor.busbarNode !== null);
    expect(droppers.length).toBeGreaterThanOrEqual(2 * 5 + 2);
    droppers.forEach((dropper) => {
      expect(dropper.from.y).toBe(BUSBAR_HEIGHT);
    });
  });

  it('draws a transformer, a load and a line exit by the terminal kind', () => {
    const scenePlan = plan(fullSubstation(), ['T4-7']);
    const shapes = new Map(scenePlan.terminals.map((terminal) => [terminal.bay, terminal.shape]));
    expect(shapes.get('T4-7')).toBe('TRANSFORMER');
    expect(shapes.get('LOAD')).toBe('LOAD');
    expect(shapes.get('L3-4')).toBe('LINE');
    expect(scenePlan.boxes.some((box) => box.role === 'transformer')).toBe(true);
    expect(scenePlan.boxes.some((box) => box.role === 'load')).toBe(true);
    expect(scenePlan.boxes.some((box) => box.role === 'tower')).toBe(true);
  });

  it('draws a generator body for a generator terminal', () => {
    const substation = fullSubstation();
    const bays = substation.bays.map((bay) =>
      bay.id === 'LOAD' && bay.terminal
        ? { ...bay, terminal: { ...bay.terminal, kind: 'GENERATOR' as const } }
        : bay,
    );
    const scenePlan = plan({ ...substation, bays });
    expect(scenePlan.terminals.find((terminal) => terminal.bay === 'LOAD')?.shape).toBe(
      'GENERATOR',
    );
    expect(scenePlan.cylinders.some((cylinder) => cylinder.role === 'generator')).toBe(true);
  });

  it('plans the same switches when every switch is described the other way round', () => {
    const substation = fullSubstation();
    const mirrored = {
      ...substation,
      switches: substation.switches.map((entry) => ({
        ...entry,
        nodeA: entry.nodeB,
        nodeB: entry.nodeA,
      })),
    };
    const original = plan(substation);
    const flipped = plan(mirrored);
    expect(flipped.switches.map((entry) => entry.id)).toEqual(
      original.switches.map((entry) => entry.id),
    );
    expect(flipped.conductors).toHaveLength(original.conductors.length);
  });

  it('plans a bay whose bus disconnectors are missing', () => {
    const substation = fullSubstation();
    const switches = substation.switches.filter(
      (entry) => !(entry.bay === 'L4-5' && entry.kind === 'DISCONNECTOR'),
    );
    const scenePlan = plan({ ...substation, switches });
    expect(scenePlan.bays.map((bay) => bay.id)).toContain('L4-5');
    expect(scenePlan.switches.filter((entry) => entry.bay === 'L4-5').length).toBeGreaterThan(0);
  });

  it('plans a bay without a terminal as a bay that ends at its breaker', () => {
    const substation = fullSubstation();
    const bays = substation.bays.map((bay) =>
      bay.id === 'L4-5' ? { ...bay, terminal: null } : bay,
    );
    const scenePlan = plan({ ...substation, bays });
    expect(scenePlan.bays.map((bay) => bay.id)).toContain('L4-5');
  });

  it('skips a bay that has no breaker', () => {
    const substation = fullSubstation();
    const switches = substation.switches.filter((entry) => entry.id !== 'L4-5.QA1');
    const scenePlan = plan({ ...substation, switches });
    expect(scenePlan.bays.map((bay) => bay.id)).not.toContain('L4-5');
    expect(scenePlan.switches.map((entry) => entry.bay)).not.toContain('L4-5');
  });

  it('plans a substation without bays as an empty yard', () => {
    const substation = fullSubstation();
    const scenePlan = plan({ ...substation, bays: [], switches: [] });
    expect(scenePlan.switches).toHaveLength(0);
    expect(scenePlan.busbars).toHaveLength(2);
    expect(scenePlan.bounds.min.x).toBeLessThan(scenePlan.bounds.max.x);
  });

  it('keeps every part inside the bounds', () => {
    const scenePlan = plan();
    scenePlan.boxes.forEach((box) => {
      expect(box.center.x).toBeGreaterThanOrEqual(scenePlan.bounds.min.x);
      expect(box.center.x).toBeLessThanOrEqual(scenePlan.bounds.max.x);
      expect(box.center.z).toBeLessThanOrEqual(scenePlan.bounds.max.z);
    });
    const center = planCenter(scenePlan);
    expect(center.x).toBeCloseTo(0);
  });

  it('puts a label above every bay', () => {
    const scenePlan = plan();
    expect(scenePlan.bays).toHaveLength(6);
    scenePlan.bays.forEach((bay) => {
      expect(bay.labelAt.y).toBeGreaterThan(BUSBAR_HEIGHT);
      expect(bay.labelAt.x).toBe(bay.x);
    });
  });
});
