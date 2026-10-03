import { acceptsVersion } from './version-gate';

describe('acceptsVersion', () => {
  it('accepts a newer version', () => {
    expect(acceptsVersion(3, 4)).toBe(true);
  });

  it('accepts the first version', () => {
    expect(acceptsVersion(0, 1)).toBe(true);
  });

  it('rejects the same version', () => {
    expect(acceptsVersion(4, 4)).toBe(false);
  });

  it('rejects an older version', () => {
    expect(acceptsVersion(5, 2)).toBe(false);
  });
});
