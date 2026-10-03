import { anchorFor, isNavKey, nextItem } from './keyboard';
import type { NavItem } from './keyboard';

function box(id: string, x: number, y: number, half = 14): NavItem {
  return { id, x1: x - half, x2: x + half, y1: y - half, y2: y + half };
}

const busbar: NavItem = {
  id: 'bb',
  x1: 0,
  x2: 600,
  y1: 66,
  y2: 74,
  links: ['a-top', 'b-top'],
};
const items: NavItem[] = [
  busbar,
  box('a-top', 100, 100),
  box('a-mid', 100, 160),
  box('a-low', 100, 220),
  box('b-top', 220, 100),
  box('b-mid', 220, 160),
];

describe('nextItem', () => {
  it('moves down a column', () => {
    expect(nextItem(items, 'a-top', 'ArrowDown', null)).toBe('a-mid');
    expect(nextItem(items, 'a-mid', 'ArrowDown', null)).toBe('a-low');
  });

  it('moves up a column and reaches the busbar from the top item', () => {
    expect(nextItem(items, 'a-low', 'ArrowUp', null)).toBe('a-mid');
    expect(nextItem(items, 'a-top', 'ArrowUp', null)).toBe('bb');
  });

  it('moves between columns on the same row', () => {
    expect(nextItem(items, 'a-top', 'ArrowRight', null)).toBe('b-top');
    expect(nextItem(items, 'b-mid', 'ArrowLeft', null)).toBe('a-mid');
  });

  it('prefers the item in line over a nearer one off to the side', () => {
    expect(nextItem(items, 'a-mid', 'ArrowRight', null)).toBe('b-mid');
  });

  it('stays put at an edge', () => {
    expect(nextItem(items, 'a-low', 'ArrowDown', null)).toBeNull();
    expect(nextItem(items, 'a-top', 'ArrowLeft', null)).toBeNull();
  });

  it('goes to the first and last item in reading order', () => {
    expect(nextItem(items, 'a-mid', 'Home', null)).toBe('bb');
    expect(nextItem(items, 'a-mid', 'End', null)).toBe('a-low');
  });

  it('starts at the first item when nothing is focused', () => {
    expect(nextItem(items, null, 'ArrowDown', null)).toBe('bb');
    expect(nextItem(items, 'missing', 'ArrowDown', null)).toBe('bb');
  });

  it('returns nothing for an empty list', () => {
    expect(nextItem([], null, 'ArrowDown', null)).toBeNull();
  });

  it('leaves the busbar in the column the user came from', () => {
    const anchor = anchorFor(busbar, { x: 220, y: 100 });
    expect(nextItem(items, 'bb', 'ArrowDown', anchor)).toBe('b-top');
    expect(nextItem(items, 'bb', 'ArrowDown', { x: 90, y: 70 })).toBe('a-top');
  });

  it('steps from a busbar along the equipment attached to it', () => {
    const anchor = { x: 150, y: 70 };
    expect(nextItem(items, 'bb', 'ArrowRight', anchor)).toBe('b-top');
    expect(nextItem(items, 'bb', 'ArrowLeft', anchor)).toBe('a-top');
    expect(nextItem(items, 'bb', 'ArrowRight', { x: 300, y: 70 })).toBeNull();
    expect(nextItem(items, 'bb', 'ArrowRight', null)).toBe('a-top');
    expect(nextItem(items, 'bb', 'ArrowLeft', { x: 50, y: 70 })).toBeNull();
  });

  it('does not jump onto a busbar when going down past it', () => {
    const crossing = [...items, { id: 'bb2', x1: 0, x2: 600, y1: 124, y2: 132, links: [] }];
    expect(nextItem(crossing, 'a-top', 'ArrowDown', null)).toBe('a-mid');
    expect(nextItem(crossing, 'a-mid', 'ArrowUp', null)).toBe('bb2');
  });

  it('breaks ties by id', () => {
    const tied = [box('start', 100, 100), box('z', 160, 100), box('y', 160, 100)];
    expect(nextItem(tied, 'start', 'ArrowRight', null)).toBe('y');
  });
});

describe('anchorFor', () => {
  it('uses the centre of a small item', () => {
    expect(anchorFor(box('a', 100, 100), { x: 5, y: 5 })).toEqual({ x: 100, y: 100 });
  });

  it('keeps the previous column on a wide item and clamps it to the item', () => {
    expect(anchorFor(busbar, { x: 220, y: 100 })).toEqual({ x: 220, y: 70 });
    expect(anchorFor(busbar, { x: 900, y: 100 })).toEqual({ x: 600, y: 70 });
  });

  it('starts a wide item at its left end when there is no previous point', () => {
    expect(anchorFor(busbar, null)).toEqual({ x: 0, y: 70 });
  });
});

describe('isNavKey', () => {
  it('accepts navigation keys only', () => {
    expect(isNavKey('ArrowUp')).toBe(true);
    expect(isNavKey('Home')).toBe(true);
    expect(isNavKey('Enter')).toBe(false);
  });
});
