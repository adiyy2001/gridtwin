export type SortDirection = 'ascending' | 'descending';

export interface SortState<K extends string> {
  readonly column: K;
  readonly direction: SortDirection;
}

export type AriaSort = 'ascending' | 'descending' | 'none';

export function nextSort<K extends string>(
  current: SortState<K>,
  column: K,
  defaultDirection: SortDirection = 'ascending',
): SortState<K> {
  if (current.column !== column) {
    return { column, direction: defaultDirection };
  }
  return { column, direction: current.direction === 'ascending' ? 'descending' : 'ascending' };
}

export function ariaSortFor<K extends string>(sort: SortState<K>, column: K): AriaSort {
  return sort.column === column ? sort.direction : 'none';
}

export function sortRows<T>(
  rows: readonly T[],
  compare: (a: T, b: T) => number,
  direction: SortDirection,
): T[] {
  const sign = direction === 'ascending' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => sign * compare(a.row, b.row) || a.index - b.index)
    .map((entry) => entry.row);
}

export function compareNumbers(a: number | null | undefined, b: number | null | undefined): number {
  const left = a ?? Number.NEGATIVE_INFINITY;
  const right = b ?? Number.NEGATIVE_INFINITY;
  return left === right ? 0 : left < right ? -1 : 1;
}

export function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true });
}
