import {
  MAX_SPACING,
  MAX_SPEED,
  MIN_SPACING,
  flowDirection,
  particleCount,
  particlePositions,
  particleSpacing,
  particleSpeed,
} from './particles';
import { branchState } from '../testing/fixtures';

describe('flowDirection', () => {
  it('follows the sign of the active power at the from end', () => {
    expect(flowDirection(branchState({ activeFromMw: 40 }))).toBe(1);
    expect(flowDirection(branchState({ activeFromMw: -40 }))).toBe(-1);
  });

  it('has no direction without a flow', () => {
    expect(flowDirection(branchState({ activeFromMw: 0.01 }))).toBe(0);
  });

  it('has no direction for a branch that is out of service or dead', () => {
    expect(flowDirection(branchState({ inService: false }))).toBe(0);
    expect(flowDirection(branchState({ energized: false }))).toBe(0);
  });
});

describe('particleSpeed', () => {
  it('grows with the active power in either direction', () => {
    expect(particleSpeed(100)).toBeGreaterThan(particleSpeed(10));
    expect(particleSpeed(-100)).toBe(particleSpeed(100));
  });

  it('is zero without a flow', () => {
    expect(particleSpeed(0)).toBe(0);
  });

  it('is capped', () => {
    expect(particleSpeed(10_000)).toBe(MAX_SPEED);
  });
});

describe('particleSpacing and particleCount', () => {
  it('packs particles closer on a heavily loaded branch', () => {
    expect(particleSpacing(1)).toBeLessThan(particleSpacing(0.1));
  });

  it('stays within bounds', () => {
    expect(particleSpacing(-1)).toBe(MAX_SPACING);
    expect(particleSpacing(5)).toBe(MIN_SPACING);
  });

  it('puts at least one particle on a short branch', () => {
    expect(particleCount(5, 30)).toBe(1);
  });

  it('fits whole spacings into the length', () => {
    expect(particleCount(100, 20)).toBe(5);
  });

  it('has none for a zero length or spacing', () => {
    expect(particleCount(0, 20)).toBe(0);
    expect(particleCount(100, 0)).toBe(0);
  });
});

describe('particlePositions', () => {
  const start = { x: 0, y: 0 };
  const end = { x: 100, y: 0 };

  it('has no particles without a direction or speed', () => {
    expect(particlePositions(start, end, 0, 50, 20, 0)).toEqual([]);
    expect(particlePositions(start, end, 1, 0, 20, 0)).toEqual([]);
  });

  it('has none on a branch of zero length', () => {
    expect(particlePositions(start, start, 1, 50, 20, 0)).toEqual([]);
  });

  it('places particles at equal spacing along the branch', () => {
    const positions = particlePositions(start, end, 1, 50, 20, 0);
    expect(positions.map((point) => point.x)).toEqual([0, 20, 40, 60, 80]);
  });

  it('moves them forward with time at the given speed', () => {
    const later = particlePositions(start, end, 1, 10, 20, 1);
    expect(later[0]?.x).toBeCloseTo(10);
  });

  it('moves them backwards when the direction is reversed', () => {
    const forward = particlePositions(start, end, 1, 10, 20, 1);
    const backward = particlePositions(start, end, -1, 10, 20, 1);
    expect(backward[0]?.x).toBeCloseTo(100 - (forward[0]?.x ?? 0));
  });

  it('keeps every particle on the branch', () => {
    for (let seconds = 0; seconds < 10; seconds += 0.7) {
      for (const point of particlePositions(start, end, 1, 33, 17, seconds)) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(100);
        expect(point.y).toBe(0);
      }
    }
  });

  it('follows a diagonal branch', () => {
    const positions = particlePositions({ x: 0, y: 0 }, { x: 30, y: 40 }, 1, 10, 25, 0);
    expect(positions[0]).toEqual({ x: 0, y: 0 });
    expect(positions[1]).toEqual({ x: 15, y: 20 });
  });
});
