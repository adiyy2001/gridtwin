import type { ContingencySummary, SeverityTier } from '../model/api-types';
import type { SortDirection, SortState } from '../shared/sorting';
import { compareNumbers, compareText, sortRows } from '../shared/sorting';

export type N1Column =
  | 'rank'
  | 'outage'
  | 'tier'
  | 'score'
  | 'maxLoading'
  | 'lowestVoltage'
  | 'shedLoadMw'
  | 'overloads';

export interface N1ColumnDefinition {
  readonly column: N1Column;
  readonly label: string;
  readonly numeric: boolean;
  readonly firstDirection: SortDirection;
}

export const N1_COLUMNS: readonly N1ColumnDefinition[] = [
  { column: 'rank', label: 'Rank', numeric: true, firstDirection: 'ascending' },
  { column: 'outage', label: 'Outage', numeric: false, firstDirection: 'ascending' },
  { column: 'tier', label: 'Result', numeric: false, firstDirection: 'descending' },
  { column: 'score', label: 'Severity', numeric: true, firstDirection: 'descending' },
  { column: 'maxLoading', label: 'Max loading', numeric: true, firstDirection: 'descending' },
  { column: 'lowestVoltage', label: 'Lowest voltage', numeric: true, firstDirection: 'ascending' },
  { column: 'shedLoadMw', label: 'Shed load', numeric: true, firstDirection: 'descending' },
  { column: 'overloads', label: 'Overloads', numeric: true, firstDirection: 'descending' },
];

export const DEFAULT_N1_SORT: SortState<N1Column> = { column: 'rank', direction: 'ascending' };

const TIER_ORDER: Record<SeverityTier, number> = {
  SECURE: 0,
  DEGRADED: 1,
  BLACKOUT: 2,
  NON_CONVERGED: 3,
};

const COMPARATORS: Record<N1Column, (a: ContingencySummary, b: ContingencySummary) => number> = {
  rank: (a, b) => compareNumbers(a.rank, b.rank),
  outage: (a, b) => compareText(a.outage.equipmentId, b.outage.equipmentId),
  tier: (a, b) => compareNumbers(TIER_ORDER[a.severity.tier], TIER_ORDER[b.severity.tier]),
  score: (a, b) => compareNumbers(a.severity.score, b.severity.score),
  maxLoading: (a, b) => compareNumbers(a.maxLoading, b.maxLoading),
  lowestVoltage: (a, b) => compareNumbers(a.lowestVoltage, b.lowestVoltage),
  shedLoadMw: (a, b) => compareNumbers(a.shedLoadMw, b.shedLoadMw),
  overloads: (a, b) => compareNumbers(a.overloadedBranches.length, b.overloadedBranches.length),
};

export function sortContingencies(
  rows: readonly ContingencySummary[],
  sort: SortState<N1Column>,
): ContingencySummary[] {
  return sortRows(rows, COMPARATORS[sort.column], sort.direction);
}

export function columnDefinition(column: N1Column): N1ColumnDefinition {
  const found = N1_COLUMNS.find((entry) => entry.column === column);
  if (found === undefined) {
    throw new Error(`unknown column ${column}`);
  }
  return found;
}
