import { fullSubstation } from '../testing/substation-fixture';
import { buildSldLayout, COLUMN_WIDTH } from './layout';

describe('buildSldLayout', () => {
  const substation = fullSubstation();
  const layout = buildSldLayout(substation);

  it('places every switch of the description exactly once', () => {
    const ids = layout.switches.map((entry) => entry.id).sort();
    expect(ids).toEqual(substation.switches.map((entry) => entry.id).sort());
  });

  it('is deterministic', () => {
    expect(buildSldLayout(substation)).toEqual(layout);
  });

  it('orders the bay columns from left to right', () => {
    const breakerX = (bay: string): number =>
      layout.switches.find((entry) => entry.id === `${bay}.QA1`)?.x ?? Number.NaN;
    expect(breakerX('L2-4')).toBeLessThan(breakerX('L3-4'));
    expect(breakerX('L3-4')).toBeLessThan(breakerX('L4-5'));
    expect(breakerX('T4-7')).toBeGreaterThan(breakerX('L4-5'));
    expect(breakerX('L3-4') - breakerX('L2-4')).toBe(COLUMN_WIDTH);
  });

  it('draws the second busbar below the first and spans every column', () => {
    const [first, second] = layout.busbars;
    expect(first?.y).toBeLessThan(second?.y ?? 0);
    const lastX = Math.max(...layout.switches.map((entry) => entry.x));
    expect(first?.x2).toBeGreaterThan(lastX);
    expect(first?.x1).toBeLessThan(Math.min(...layout.switches.map((entry) => entry.x)));
  });

  it('stacks the equipment of a feeder bay from the busbars down to the terminal', () => {
    const y = (id: string): number =>
      layout.switches.find((entry) => entry.id === id)?.y ?? Number.NaN;
    const terminal = layout.terminals.find((entry) => entry.bay === 'L2-4');
    expect(y('L2-4.QB1')).toBeLessThan(y('L2-4.QB2'));
    expect(y('L2-4.QB2')).toBeLessThan(y('L2-4.QA1'));
    expect(y('L2-4.QA1')).toBeLessThan(y('L2-4.QB9'));
    expect(y('L2-4.QB9')).toBeLessThan(terminal?.y ?? 0);
  });

  it('puts the two bus disconnectors of a feeder on separate spurs around the column', () => {
    const first = layout.switches.find((entry) => entry.id === 'L2-4.QB1');
    const second = layout.switches.find((entry) => entry.id === 'L2-4.QB2');
    const breaker = layout.switches.find((entry) => entry.id === 'L2-4.QA1');
    expect(first?.x).toBeLessThan(breaker?.x ?? 0);
    expect(second?.x).toBeGreaterThan(breaker?.x ?? 0);
    expect(first?.labelAnchor).toBe('end');
    expect(second?.labelAnchor).toBe('start');
  });

  it('draws the coupler as a loop that reaches both busbars', () => {
    const upper = layout.switches.find((entry) => entry.id === 'CPL.QB1');
    const lower = layout.switches.find((entry) => entry.id === 'CPL.QB2');
    const breaker = layout.switches.find((entry) => entry.id === 'CPL.QA1');
    expect(upper?.x).toBeLessThan(lower?.x ?? 0);
    expect(breaker?.x).toBe(upper?.x);
    expect(upper?.y).toBeLessThan(layout.busbars[1]?.y ?? 0);
    expect(lower?.y).toBeGreaterThan(layout.busbars[1]?.y ?? 0);
  });

  it('puts earthing switches beside the node they ground', () => {
    const earthing = layout.switches.find((entry) => entry.id === 'L2-4.QE1');
    const breaker = layout.switches.find((entry) => entry.id === 'L2-4.QA1');
    expect(earthing?.x).toBeGreaterThan(breaker?.x ?? 0);
    const left = layout.switches.find((entry) => entry.id === 'CPL.QE1');
    const right = layout.switches.find((entry) => entry.id === 'CPL.QE2');
    expect(left?.x).toBeLessThan(right?.x ?? 0);
  });

  it('never overlaps two switch symbols', () => {
    layout.switches.forEach((entry, index) => {
      layout.switches.slice(index + 1).forEach((other) => {
        const apart = Math.abs(entry.x - other.x) >= 30 || Math.abs(entry.y - other.y) >= 30;
        expect(apart, `${entry.id} and ${other.id}`).toBe(true);
      });
    });
  });

  it('adds a terminal and a caption for every feeder and a caption for the coupler', () => {
    expect(layout.terminals.map((entry) => entry.bay)).toEqual([
      'L2-4',
      'L3-4',
      'L4-5',
      'T4-7',
      'LOAD',
    ]);
    expect(layout.captions).toHaveLength(6);
    expect(layout.captions.find((entry) => entry.bay === 'T4-7')?.lines).toEqual([
      'T4-7',
      'Transformer to',
      'bus 7',
    ]);
  });

  it('fits everything inside the drawing', () => {
    layout.switches.forEach((entry) => {
      expect(entry.x).toBeGreaterThan(0);
      expect(entry.x).toBeLessThan(layout.width);
      expect(entry.y).toBeLessThan(layout.height);
    });
    layout.captions.forEach((caption) => {
      expect(caption.y + caption.lines.length * 16).toBeLessThan(layout.height);
    });
  });

  it('assigns every wire to a node of the substation', () => {
    const nodes = new Set([...substation.nodes]);
    layout.wires.forEach((wire) => {
      expect(nodes.has(wire.node), wire.id).toBe(true);
    });
  });

  it('skips a bay without a breaker', () => {
    const broken = {
      ...substation,
      switches: substation.switches.filter(
        (entry) => entry.id !== 'L3-4.QA1' && entry.id !== 'CPL.QA1',
      ),
    };
    const partial = buildSldLayout(broken);
    expect(partial.switches.some((entry) => entry.bay === 'L3-4')).toBe(false);
    expect(partial.switches.some((entry) => entry.bay === 'CPL')).toBe(false);
  });

  it('draws a feeder without a line disconnector straight to its terminal', () => {
    const trimmed = {
      ...substation,
      switches: substation.switches.filter((entry) => entry.id !== 'L3-4.QB9'),
    };
    const result = buildSldLayout(trimmed);
    expect(result.switches.some((entry) => entry.id === 'L3-4.QB9')).toBe(false);
    expect(result.terminals.some((entry) => entry.bay === 'L3-4')).toBe(true);
  });

  it('copes with a single busbar', () => {
    const single = {
      ...substation,
      busbars: substation.busbars.slice(0, 1),
      switches: substation.switches.filter((entry) => !entry.id.endsWith('.QB2')),
    };
    const result = buildSldLayout(single);
    expect(result.busbars).toHaveLength(1);
    expect(result.switches.some((entry) => entry.id === 'L2-4.QB1')).toBe(true);
  });
});
