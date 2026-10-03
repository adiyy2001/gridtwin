import { ariaSortFor, compareNumbers, compareText, nextSort, sortRows } from './sorting';
import type { SortState } from './sorting';

describe('sorting', () => {
  const rows = [
    { id: 'b', value: 2 },
    { id: 'a', value: 2 },
    { id: 'c', value: 1 },
  ];
  const byValue = (x: { value: number }, y: { value: number }): number =>
    compareNumbers(x.value, y.value);

  it('sorts ascending and keeps equal rows in their original order', () => {
    expect(sortRows(rows, byValue, 'ascending').map((row) => row.id)).toEqual(['c', 'b', 'a']);
  });

  it('sorts descending and keeps equal rows in their original order', () => {
    expect(sortRows(rows, byValue, 'descending').map((row) => row.id)).toEqual(['b', 'a', 'c']);
  });

  it('does not change the input', () => {
    sortRows(rows, byValue, 'ascending');
    expect(rows.map((row) => row.id)).toEqual(['b', 'a', 'c']);
  });

  it('compares numbers and puts missing values first', () => {
    expect(compareNumbers(1, 2)).toBe(-1);
    expect(compareNumbers(2, 1)).toBe(1);
    expect(compareNumbers(2, 2)).toBe(0);
    expect(compareNumbers(null, 0)).toBe(-1);
    expect(compareNumbers(undefined, null)).toBe(0);
  });

  it('compares text with numbers in natural order', () => {
    expect(['L10', 'L2', 'L1'].sort(compareText)).toEqual(['L1', 'L2', 'L10']);
  });
});

describe('sort state', () => {
  const current: SortState<'a' | 'b'> = { column: 'a', direction: 'ascending' };

  it('flips the direction of the active column', () => {
    expect(nextSort(current, 'a')).toEqual({ column: 'a', direction: 'descending' });
    expect(nextSort({ column: 'a', direction: 'descending' }, 'a')).toEqual({
      column: 'a',
      direction: 'ascending',
    });
  });

  it('starts another column in its first direction', () => {
    expect(nextSort(current, 'b')).toEqual({ column: 'b', direction: 'ascending' });
    expect(nextSort(current, 'b', 'descending')).toEqual({ column: 'b', direction: 'descending' });
  });

  it('maps the state to aria-sort', () => {
    expect(ariaSortFor(current, 'a')).toBe('ascending');
    expect(ariaSortFor(current, 'b')).toBe('none');
  });
});
