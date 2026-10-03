export interface BackoffPolicy {
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly factor: number;
  readonly maxAttempts: number;
}

export const DEFAULT_BACKOFF: BackoffPolicy = {
  initialDelayMs: 500,
  maxDelayMs: 8000,
  factor: 2,
  maxAttempts: 6,
};

export function backoffDelayMs(attempt: number, policy: BackoffPolicy = DEFAULT_BACKOFF): number {
  const raw = policy.initialDelayMs * Math.pow(policy.factor, Math.max(0, attempt - 1));
  return Math.min(raw, policy.maxDelayMs);
}

export function hasAttemptsLeft(attempt: number, policy: BackoffPolicy = DEFAULT_BACKOFF): boolean {
  return attempt <= policy.maxAttempts;
}
