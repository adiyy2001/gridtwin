import {
  DEENERGIZED_COLOUR,
  MONITORED_VOLTAGE_MAX,
  MONITORED_VOLTAGE_MIN,
  loadingBand,
  loadingBandLabel,
  loadingColour,
  loadingStrokeWidth,
  voltageOutOfBand,
  voltageShade,
} from './colour-scale';
import type { LoadingBand } from './colour-scale';

function channels(hex: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

describe('loadingColour', () => {
  it('is green when idle', () => {
    expect(loadingColour(0)).toBe('#1f8a4c');
  });

  it('is red at the rating', () => {
    expect(loadingColour(1)).toBe('#d63a2f');
  });

  it('stays red above the rating', () => {
    expect(loadingColour(1.8)).toBe('#d63a2f');
  });

  it('passes through an amber stop', () => {
    expect(loadingColour(0.85)).toBe('#d69600');
  });

  it('moves from green towards red as the loading rises', () => {
    const low = channels(loadingColour(0.2));
    const high = channels(loadingColour(0.95));
    expect(high.r).toBeGreaterThan(low.r);
    expect(high.g).toBeLessThan(low.g + 1);
  });

  it('treats a negative or non-finite loading as zero', () => {
    expect(loadingColour(-3)).toBe(loadingColour(0));
    expect(loadingColour(Number.NaN)).toBe(loadingColour(0));
  });
});

describe('loadingBand', () => {
  const cases: [number, LoadingBand][] = [
    [0, 'idle'],
    [0.3, 'normal'],
    [0.6, 'elevated'],
    [0.84, 'elevated'],
    [0.85, 'high'],
    [1, 'high'],
    [1.01, 'overloaded'],
  ];

  it.each(cases)('puts %s into %s', (loading, band) => {
    expect(loadingBand(loading)).toBe(band);
  });

  it('describes every band in words', () => {
    const bands: LoadingBand[] = ['idle', 'normal', 'elevated', 'high', 'overloaded'];
    const labels = bands.map((band) => loadingBandLabel(band));
    expect(new Set(labels).size).toBe(bands.length);
  });

  it('draws heavier lines for higher bands', () => {
    expect(loadingStrokeWidth('normal')).toBeLessThan(loadingStrokeWidth('elevated'));
    expect(loadingStrokeWidth('elevated')).toBeLessThan(loadingStrokeWidth('high'));
    expect(loadingStrokeWidth('high')).toBeLessThan(loadingStrokeWidth('overloaded'));
    expect(loadingStrokeWidth('idle')).toBe(loadingStrokeWidth('normal'));
  });
});

describe('voltageShade', () => {
  it('is light at the lower limit and dark at the upper limit', () => {
    const low = channels(voltageShade(0.94, 0.94, 1.06));
    const high = channels(voltageShade(1.06, 0.94, 1.06));
    expect(low.r).toBeGreaterThan(high.r);
  });

  it('clamps outside the limits', () => {
    expect(voltageShade(0.5, 0.94, 1.06)).toBe(voltageShade(0.94, 0.94, 1.06));
    expect(voltageShade(2, 0.94, 1.06)).toBe(voltageShade(1.06, 0.94, 1.06));
  });

  it('uses the middle shade for an empty band', () => {
    expect(voltageShade(1, 1, 1)).toBe(voltageShade(1, 0.9, 1.1));
  });

  it('flags a voltage outside the monitored band', () => {
    expect(voltageOutOfBand(MONITORED_VOLTAGE_MIN - 0.01)).toBe(true);
    expect(voltageOutOfBand(MONITORED_VOLTAGE_MAX + 0.01)).toBe(true);
    expect(voltageOutOfBand(1)).toBe(false);
  });

  it('has a grey for de-energized parts', () => {
    expect(DEENERGIZED_COLOUR).toMatch(/^#[0-9a-f]{6}$/);
  });
});
