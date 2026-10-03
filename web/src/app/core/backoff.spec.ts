import { DEFAULT_BACKOFF, backoffDelayMs, hasAttemptsLeft } from './backoff';

describe('backoff', () => {
  it('starts at the initial delay', () => {
    expect(backoffDelayMs(1)).toBe(DEFAULT_BACKOFF.initialDelayMs);
  });

  it('doubles with every attempt', () => {
    expect(backoffDelayMs(2)).toBe(1000);
    expect(backoffDelayMs(3)).toBe(2000);
  });

  it('never exceeds the maximum delay', () => {
    expect(backoffDelayMs(20)).toBe(DEFAULT_BACKOFF.maxDelayMs);
  });

  it('treats attempt zero like the first attempt', () => {
    expect(backoffDelayMs(0)).toBe(DEFAULT_BACKOFF.initialDelayMs);
  });

  it('stops after the maximum number of attempts', () => {
    expect(hasAttemptsLeft(DEFAULT_BACKOFF.maxAttempts)).toBe(true);
    expect(hasAttemptsLeft(DEFAULT_BACKOFF.maxAttempts + 1)).toBe(false);
  });
});
