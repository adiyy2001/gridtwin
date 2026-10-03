import { DEFAULT_N1_SORT, N1_COLUMNS, columnDefinition, sortContingencies } from './n1-sorting';
import type { N1Column } from './n1-sorting';
import { contingency, contingencyReport } from '../testing/fixtures';

describe('sortContingencies', () => {
  const rows = contingencyReport().contingencies;

  function ids(column: N1Column, direction: 'ascending' | 'descending'): string[] {
    return sortContingencies(rows, { column, direction }).map((row) => row.id);
  }

  it('sorts by rank by default', () => {
    expect(sortContingencies(rows, DEFAULT_N1_SORT).map((row) => row.rank)).toEqual([1, 2, 3]);
  });

  it('sorts by outage name', () => {
    expect(ids('outage', 'ascending')).toEqual(['generator:G1', 'branch:L1-2', 'branch:L2-4']);
  });

  it('sorts by result tier from secure to no solution', () => {
    expect(ids('tier', 'ascending')).toEqual(['generator:G1', 'branch:L1-2', 'branch:L2-4']);
  });

  it('sorts by severity score', () => {
    expect(ids('score', 'descending')).toEqual(['branch:L2-4', 'branch:L1-2', 'generator:G1']);
  });

  it('sorts by maximum loading', () => {
    expect(ids('maxLoading', 'descending')[0]).toBe('branch:L1-2');
  });

  it('puts a missing lowest voltage first when ascending', () => {
    expect(ids('lowestVoltage', 'ascending')[0]).toBe('branch:L2-4');
  });

  it('sorts by shed load', () => {
    expect(ids('shedLoadMw', 'descending')[0]).toBe('branch:L2-4');
  });

  it('sorts by the number of overloads', () => {
    const rowsWithOverloads = [
      contingency({ rank: 1, id: 'a', overloadedBranches: ['x'] }),
      contingency({ rank: 2, id: 'b', overloadedBranches: ['x', 'y'] }),
    ];
    const sorted = sortContingencies(rowsWithOverloads, {
      column: 'overloads',
      direction: 'descending',
    });
    expect(sorted.map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('knows every column', () => {
    for (const column of N1_COLUMNS) {
      expect(columnDefinition(column.column)).toBe(column);
    }
  });

  it('rejects an unknown column', () => {
    expect(() => columnDefinition('nope' as N1Column)).toThrow('unknown column');
  });
});
