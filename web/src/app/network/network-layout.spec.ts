import {
  PARALLEL_SPACING,
  SPLIT_BUS_OFFSET,
  VIEW_PADDING,
  branchGeometry,
  buildLayout,
  parallelIndexes,
} from './network-layout';
import { caseDetail } from '../testing/fixtures';

describe('buildLayout', () => {
  it('takes bus positions from the case', () => {
    const layout = buildLayout(caseDetail());
    expect(layout.positions.get(1)).toEqual({ x: 100, y: 100 });
    expect(layout.positions.get(4)).toEqual({ x: 300, y: 300 });
  });

  it('places the second busbar of the substation next to its bus', () => {
    const layout = buildLayout(caseDetail());
    expect(layout.positions.get(40)).toEqual({
      x: 300 + SPLIT_BUS_OFFSET.x,
      y: 300 + SPLIT_BUS_OFFSET.y,
    });
  });

  it('pads the view box around every position', () => {
    const { viewBox } = buildLayout(caseDetail());
    expect(viewBox.x).toBe(100 - VIEW_PADDING);
    expect(viewBox.y).toBe(100 - VIEW_PADDING);
    expect(viewBox.x + viewBox.width).toBeGreaterThanOrEqual(
      300 + SPLIT_BUS_OFFSET.x + VIEW_PADDING,
    );
    expect(viewBox.y + viewBox.height).toBeGreaterThanOrEqual(
      300 + SPLIT_BUS_OFFSET.y + VIEW_PADDING,
    );
  });

  it('puts buses without coordinates on a ring', () => {
    const detail = caseDetail();
    const withoutCoordinates = {
      ...detail,
      substation: null,
      buses: detail.buses.map((bus) => ({ ...bus, x: null, y: null })),
    };
    const positions = [...buildLayout(withoutCoordinates).positions.values()];
    expect(new Set(positions.map((point) => `${point.x}:${point.y}`)).size).toBe(3);
  });

  it('works without a substation', () => {
    const layout = buildLayout({ ...caseDetail(), substation: null });
    expect(layout.positions.has(40)).toBe(false);
  });

  it('ignores a substation whose bus is unknown', () => {
    const detail = caseDetail();
    const substation = detail.substation;
    if (!substation) {
      throw new Error('missing substation');
    }
    const layout = buildLayout({ ...detail, substation: { ...substation, bus: 99 } });
    expect(layout.positions.has(40)).toBe(false);
  });
});

describe('branchGeometry', () => {
  const from = { x: 0, y: 0 };
  const to = { x: 100, y: 0 };

  it('has the length and middle of the segment', () => {
    const geometry = branchGeometry(from, to, 0);
    expect(geometry.length).toBe(100);
    expect(geometry.middle).toEqual({ x: 50, y: 0 });
  });

  it('puts the label beside the line', () => {
    const geometry = branchGeometry(from, to, 0, 1);
    expect(geometry.labelAt.x).toBe(50);
    expect(geometry.labelAt.y).not.toBe(0);
    const other = branchGeometry(from, to, 0, -1);
    expect(other.labelAt.y).toBe(-geometry.labelAt.y);
  });

  it('shifts a parallel branch sideways', () => {
    const geometry = branchGeometry(from, to, 1);
    expect(Math.abs(geometry.start.y)).toBe(PARALLEL_SPACING);
    expect(geometry.start.x).toBeCloseTo(0);
  });

  it('copes with a zero length', () => {
    const geometry = branchGeometry(from, from, 2);
    expect(geometry.length).toBe(0);
    expect(geometry.start).toEqual(from);
  });
});

describe('parallelIndexes', () => {
  it('numbers branches that join the same pair of buses', () => {
    const indexes = parallelIndexes([
      { id: 'a', from: 1, to: 2 },
      { id: 'b', from: 2, to: 1 },
      { id: 'c', from: 1, to: 3 },
    ]);
    expect(indexes.get('a')).toBe(0);
    expect(indexes.get('b')).toBe(1);
    expect(indexes.get('c')).toBe(0);
  });
});
