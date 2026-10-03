import {
  branchStateLabel,
  busStateLabel,
  cascadeEndLabel,
  formatDegrees,
  formatKa,
  formatKv,
  formatMvar,
  formatMw,
  formatPerUnit,
  formatPercent,
  formatScore,
  oppositePosition,
  positionLabel,
  tierLabel,
} from './format';

describe('number formats', () => {
  it('formats a loading as a percentage', () => {
    expect(formatPercent(1.141)).toBe('114.1%');
    expect(formatPercent(0.5, 0)).toBe('50%');
  });

  it('formats power with its unit', () => {
    expect(formatMw(12.345)).toBe('12.3 MW');
    expect(formatMvar(-4.04)).toBe('-4.0 MVAr');
  });

  it('formats voltage and current', () => {
    expect(formatKv(134.332)).toBe('134.3 kV');
    expect(formatKa(0.65279)).toBe('0.653 kA');
    expect(formatPerUnit(1.0177)).toBe('1.018 pu');
  });

  it('formats an angle with the degree sign', () => {
    expect(formatDegrees(-10.3129)).toBe('-10.31°');
  });

  it('formats a severity score', () => {
    expect(formatScore(3.78912)).toBe('3.789');
  });

  it('prints n/a for missing and non-finite values', () => {
    expect(formatPercent(null)).toBe('n/a');
    expect(formatPercent(undefined)).toBe('n/a');
    expect(formatPercent(Number.NaN)).toBe('n/a');
    expect(formatMw(null)).toBe('n/a');
    expect(formatMvar(undefined)).toBe('n/a');
    expect(formatKv(Number.POSITIVE_INFINITY)).toBe('n/a');
    expect(formatKa(null)).toBe('n/a');
    expect(formatPerUnit(null)).toBe('n/a');
    expect(formatDegrees(null)).toBe('n/a');
    expect(formatScore(null)).toBe('n/a');
  });
});

describe('labels', () => {
  it('labels the severity tiers', () => {
    expect(tierLabel('SECURE')).toBe('Secure');
    expect(tierLabel('DEGRADED')).toBe('Degraded');
    expect(tierLabel('BLACKOUT')).toBe('Blackout');
    expect(tierLabel('NON_CONVERGED')).toBe('No solution');
  });

  it('labels positions and flips them', () => {
    expect(positionLabel('OPEN')).toBe('Open');
    expect(positionLabel('CLOSED')).toBe('Closed');
    expect(oppositePosition('OPEN')).toBe('CLOSED');
    expect(oppositePosition('CLOSED')).toBe('OPEN');
  });

  it('labels bus states', () => {
    expect(busStateLabel({ state: 'ENERGIZED' })).toBe('Energized');
    expect(busStateLabel({ state: 'DEENERGIZED' })).toBe('De-energized');
    expect(busStateLabel({ state: 'COLLAPSED' })).toBe('Voltage collapse');
  });

  it('labels branch states', () => {
    expect(branchStateLabel({ inService: false, energized: false })).toBe('Out of service');
    expect(branchStateLabel({ inService: true, energized: false })).toBe('De-energized');
    expect(branchStateLabel({ inService: true, energized: true })).toBe('Energized');
  });

  it('labels how a cascade ended', () => {
    expect(cascadeEndLabel('STABLE')).toBe('stable');
    expect(cascadeEndLabel('BLACKOUT')).toBe('blackout');
    expect(cascadeEndLabel('NON_CONVERGED')).toBe('no solution');
    expect(cascadeEndLabel('STEP_LIMIT')).toBe('step limit');
  });
});
