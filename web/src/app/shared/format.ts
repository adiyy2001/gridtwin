import type { BranchState, BusState, Cascade, Position, SeverityTier } from '../model/api-types';

const MISSING = 'n/a';

function fixed(value: number | null | undefined, digits: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return MISSING;
  }
  return value.toFixed(digits);
}

export function formatPercent(fraction: number | null | undefined, digits = 1): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) {
    return MISSING;
  }
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatMw(value: number | null | undefined): string {
  const text = fixed(value, 1);
  return text === MISSING ? text : `${text} MW`;
}

export function formatMvar(value: number | null | undefined): string {
  const text = fixed(value, 1);
  return text === MISSING ? text : `${text} MVAr`;
}

export function formatKv(value: number | null | undefined): string {
  const text = fixed(value, 1);
  return text === MISSING ? text : `${text} kV`;
}

export function formatKa(value: number | null | undefined): string {
  const text = fixed(value, 3);
  return text === MISSING ? text : `${text} kA`;
}

export function formatPerUnit(value: number | null | undefined): string {
  const text = fixed(value, 3);
  return text === MISSING ? text : `${text} pu`;
}

export function formatDegrees(value: number | null | undefined): string {
  const text = fixed(value, 2);
  return text === MISSING ? text : `${text}°`;
}

export function formatScore(value: number | null | undefined): string {
  return fixed(value, 3);
}

export function tierLabel(tier: SeverityTier): string {
  switch (tier) {
    case 'SECURE':
      return 'Secure';
    case 'DEGRADED':
      return 'Degraded';
    case 'BLACKOUT':
      return 'Blackout';
    case 'NON_CONVERGED':
      return 'No solution';
  }
}

export function positionLabel(position: Position): string {
  return position === 'OPEN' ? 'Open' : 'Closed';
}

export function oppositePosition(position: Position): Position {
  return position === 'OPEN' ? 'CLOSED' : 'OPEN';
}

export function busStateLabel(bus: Pick<BusState, 'state'>): string {
  switch (bus.state) {
    case 'ENERGIZED':
      return 'Energized';
    case 'COLLAPSED':
      return 'Voltage collapse';
    case 'DEENERGIZED':
      return 'De-energized';
  }
}

export function branchStateLabel(branch: Pick<BranchState, 'inService' | 'energized'>): string {
  if (!branch.inService) {
    return 'Out of service';
  }
  return branch.energized ? 'Energized' : 'De-energized';
}

export function cascadeEndLabel(end: Cascade['end']): string {
  switch (end) {
    case 'STABLE':
      return 'stable';
    case 'BLACKOUT':
      return 'blackout';
    case 'NON_CONVERGED':
      return 'no solution';
    case 'STEP_LIMIT':
      return 'step limit';
  }
}
