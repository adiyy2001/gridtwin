import { HttpErrorResponse } from '@angular/common/http';

import { ApiError, toApiError } from './api-error';

describe('toApiError', () => {
  it('keeps an ApiError as it is', () => {
    const error = new ApiError(409, 'refused', 'No.', 'S1');
    expect(toApiError(error)).toBe(error);
  });

  it('reads the error body of a refused operation', () => {
    const response = new HttpErrorResponse({
      status: 409,
      error: { code: 'interlock', message: 'Open the breaker first.', switchId: 'QB1' },
    });
    const error = toApiError(response);
    expect(error.status).toBe(409);
    expect(error.code).toBe('interlock');
    expect(error.message).toBe('Open the breaker first.');
    expect(error.switchId).toBe('QB1');
  });

  it('reads a body without a switch id', () => {
    const response = new HttpErrorResponse({
      status: 404,
      error: { code: 'x', message: 'Unknown.' },
    });
    expect(toApiError(response).switchId).toBeNull();
  });

  it('reports an unreachable server', () => {
    const error = toApiError(new HttpErrorResponse({ status: 0 }));
    expect(error.code).toBe('unreachable');
  });

  it('reports a status without a body', () => {
    const error = toApiError(new HttpErrorResponse({ status: 502, error: 'bad gateway' }));
    expect(error.code).toBe('http-error');
    expect(error.message).toContain('502');
  });

  it('wraps a plain error', () => {
    expect(toApiError(new Error('boom')).message).toBe('boom');
  });

  it('wraps an unknown value', () => {
    expect(toApiError('x').code).toBe('unexpected');
  });

  it('rejects a body that is not an error body', () => {
    const response = new HttpErrorResponse({ status: 500, error: { code: 3 } });
    expect(toApiError(response).code).toBe('http-error');
  });
});
