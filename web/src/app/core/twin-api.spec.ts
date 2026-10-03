import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiError } from './api-error';
import { TwinApi } from './twin-api';

describe('TwinApi', () => {
  let api: TwinApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(TwinApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('lists the cases', () => {
    let result: unknown;
    api.listCases().subscribe((value) => (result = value));
    backend.expectOne('/api/cases').flush([{ id: 'ieee14' }]);
    expect(result).toEqual([{ id: 'ieee14' }]);
  });

  it('reads one case', () => {
    api.getCase('ieee14').subscribe();
    backend.expectOne('/api/cases/ieee14').flush({});
  });

  it('creates a session for a case', () => {
    api.createSession('ieee14').subscribe();
    const request = backend.expectOne('/api/sessions');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ caseId: 'ieee14' });
    request.flush({});
  });

  it('reads the state of a session', () => {
    api.getState('abc').subscribe();
    backend.expectOne('/api/sessions/abc/state').flush({});
  });

  it('operates a switch with the wanted position', () => {
    api.operateSwitch('abc', 'CPL.QA1', 'OPEN').subscribe();
    const request = backend.expectOne('/api/sessions/abc/switches/CPL.QA1');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ position: 'OPEN' });
    request.flush({});
  });

  it('sets the load factor', () => {
    api.setLoadFactor('abc', 1.2).subscribe();
    const request = backend.expectOne('/api/sessions/abc/load-factor');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ loadFactor: 1.2 });
    request.flush({});
  });

  it('runs the contingencies', () => {
    api.runContingencies('abc').subscribe();
    const request = backend.expectOne('/api/sessions/abc/analyses/n-1');
    expect(request.request.method).toBe('POST');
    request.flush({});
  });

  it('encodes the contingency id when it asks for a preview', () => {
    api.previewContingency('abc', 'branch:L2-4').subscribe();
    backend.expectOne('/api/sessions/abc/analyses/n-1/branch%3AL2-4').flush({});
  });

  it('runs a cascade from a trigger', () => {
    api.runCascade('abc', 'branch:L2-4').subscribe();
    const request = backend.expectOne('/api/sessions/abc/analyses/cascade');
    expect(request.request.body).toEqual({ trigger: 'branch:L2-4' });
    request.flush({});
  });

  it('turns an error response into an ApiError', () => {
    let failure: unknown;
    api
      .operateSwitch('abc', 'QB1', 'CLOSED')
      .subscribe({ error: (error: unknown) => (failure = error) });
    backend
      .expectOne('/api/sessions/abc/switches/QB1')
      .flush(
        { code: 'interlock', message: 'Open the breaker first.', switchId: 'QB1' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).message).toBe('Open the breaker first.');
  });
});
