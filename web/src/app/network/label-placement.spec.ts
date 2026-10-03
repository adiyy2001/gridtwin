import { placeLabels } from './label-placement';
import type { LabelRequest } from './label-placement';
import { branchGeometry } from './network-layout';

function request(
  id: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
): LabelRequest {
  return { id, geometry: branchGeometry(from, to, 0), characters: id.length + 5 };
}

describe('placeLabels', () => {
  it('keeps the middle of a lone branch', () => {
    const lone = request('L1-2', { x: 0, y: 0 }, { x: 300, y: 0 });
    const labels = placeLabels([lone], []);
    expect(labels.get('L1-2')?.x).toBeCloseTo(150);
  });

  it('moves a label that would sit on another label', () => {
    const first = request('L1-2', { x: 0, y: 0 }, { x: 300, y: 300 });
    const second = request('L3-4', { x: 300, y: 0 }, { x: 0, y: 300 });
    const labels = placeLabels([first, second], []);
    const a = labels.get('L1-2');
    const b = labels.get('L3-4');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    const apart =
      Math.abs((a?.x ?? 0) - (b?.x ?? 0)) > 60 || Math.abs((a?.y ?? 0) - (b?.y ?? 0)) > 18;
    expect(apart).toBe(true);
  });

  it('keeps labels away from the bus labels', () => {
    const crowded = request('L1-2', { x: 0, y: 0 }, { x: 300, y: 0 });
    const labels = placeLabels([crowded], [{ x: 150, y: 12 }]);
    const point = labels.get('L1-2');
    expect(Math.abs((point?.x ?? 150) - 150) > 40 || Math.abs((point?.y ?? 0) - 12) > 30).toBe(
      true,
    );
  });

  it('places a label for a zero length branch', () => {
    const labels = placeLabels([request('L1-2', { x: 5, y: 5 }, { x: 5, y: 5 })], []);
    expect(labels.get('L1-2')).toEqual({ x: 5, y: 5 });
  });

  it('falls back to the least crowded spot when everything collides', () => {
    const buses = Array.from({ length: 30 }, (_, index) => ({ x: index * 12, y: 0 }));
    const labels = placeLabels([request('L1-2', { x: 0, y: 0 }, { x: 360, y: 0 })], buses);
    expect(labels.has('L1-2')).toBe(true);
  });

  it('steers a label away from a line that crosses its middle', () => {
    const horizontal = request('L1-2', { x: 0, y: 0 }, { x: 300, y: 0 });
    const vertical = request('L3-4', { x: 150, y: -200 }, { x: 150, y: 200 });
    const labels = placeLabels([horizontal, vertical], []);
    expect(Math.abs((labels.get('L1-2')?.x ?? 150) - 150)).toBeGreaterThan(20);
  });
});
