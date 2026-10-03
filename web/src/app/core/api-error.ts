import { HttpErrorResponse } from '@angular/common/http';

import type { ErrorBody } from '../model/api-types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly switchId: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate['code'] === 'string' && typeof candidate['message'] === 'string';
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    if (isErrorBody(error.error)) {
      return new ApiError(
        error.status,
        error.error.code,
        error.error.message,
        error.error.switchId ?? null,
      );
    }
    if (error.status === 0) {
      return new ApiError(0, 'unreachable', 'The server cannot be reached.', null);
    }
    return new ApiError(error.status, 'http-error', `The server answered ${error.status}.`, null);
  }
  const message = error instanceof Error ? error.message : 'Unexpected failure.';
  return new ApiError(0, 'unexpected', message, null);
}
