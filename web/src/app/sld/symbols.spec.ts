import { earthingSymbol, switchSymbol, terminalSymbol } from './symbols';

describe('switch symbols', () => {
  it('draws a closed blade along the line and an open blade at an angle', () => {
    expect(switchSymbol('DISCONNECTOR', 'CLOSED').blade).toBe('M0 8 L0 -8');
    expect(switchSymbol('DISCONNECTOR', 'OPEN').blade).toBe('M0 8 L-9 -5');
  });

  it('marks a breaker with a cross and a disconnector with a contact bar', () => {
    expect(switchSymbol('BREAKER', 'CLOSED').contact).toContain('L');
    expect(switchSymbol('DISCONNECTOR', 'CLOSED').contact).toBe('M-5 -8 H5');
  });

  it('leaves the stubs the same in both positions', () => {
    expect(switchSymbol('BREAKER', 'OPEN').stubs).toBe(switchSymbol('BREAKER', 'CLOSED').stubs);
  });

  it('draws an earthing blade that reaches the ground only when closed', () => {
    expect(earthingSymbol('CLOSED').blade).toBe('M0 0 L0 12');
    expect(earthingSymbol('OPEN').blade).toBe('M0 0 L-7 9');
    expect(earthingSymbol('OPEN').ground).toContain('H8');
  });
});

describe('terminal symbols', () => {
  it('draws two circles for a transformer', () => {
    const symbol = terminalSymbol('BRANCH', true);
    expect(symbol.circles).toHaveLength(2);
    expect(symbol.outline).toBe('');
  });

  it('draws an open arrow for a line exit', () => {
    const symbol = terminalSymbol('BRANCH', false);
    expect(symbol.filled).toBe(false);
    expect(symbol.outline).toContain('V16');
  });

  it('draws a filled arrow for a load', () => {
    expect(terminalSymbol('LOAD', false).filled).toBe(true);
  });

  it('draws a circle for a generator', () => {
    expect(terminalSymbol('GENERATOR', false).circles).toHaveLength(1);
  });
});
