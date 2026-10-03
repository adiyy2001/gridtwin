import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, catchError, throwError } from 'rxjs';

import { toApiError } from './api-error';
import type {
  Cascade,
  CaseDetail,
  CaseSummary,
  ContingencyPreview,
  ContingencyReport,
  Position,
  SessionCreated,
  VersionedState,
} from '../model/api-types';

@Injectable({ providedIn: 'root' })
export class TwinApi {
  private readonly http = inject(HttpClient);

  listCases(): Observable<CaseSummary[]> {
    return this.guard(this.http.get<CaseSummary[]>('/api/cases'));
  }

  getCase(caseId: string): Observable<CaseDetail> {
    return this.guard(this.http.get<CaseDetail>(`/api/cases/${encodeURIComponent(caseId)}`));
  }

  createSession(caseId: string): Observable<SessionCreated> {
    return this.guard(this.http.post<SessionCreated>('/api/sessions', { caseId }));
  }

  getState(sessionId: string): Observable<VersionedState> {
    return this.guard(this.http.get<VersionedState>(`${this.session(sessionId)}/state`));
  }

  operateSwitch(
    sessionId: string,
    switchId: string,
    position: Position,
  ): Observable<VersionedState> {
    return this.guard(
      this.http.post<VersionedState>(
        `${this.session(sessionId)}/switches/${encodeURIComponent(switchId)}`,
        { position },
      ),
    );
  }

  setLoadFactor(sessionId: string, loadFactor: number): Observable<VersionedState> {
    return this.guard(
      this.http.put<VersionedState>(`${this.session(sessionId)}/load-factor`, { loadFactor }),
    );
  }

  runContingencies(sessionId: string): Observable<ContingencyReport> {
    return this.guard(
      this.http.post<ContingencyReport>(`${this.session(sessionId)}/analyses/n-1`, null),
    );
  }

  previewContingency(sessionId: string, contingencyId: string): Observable<ContingencyPreview> {
    return this.guard(
      this.http.get<ContingencyPreview>(
        `${this.session(sessionId)}/analyses/n-1/${encodeURIComponent(contingencyId)}`,
      ),
    );
  }

  runCascade(sessionId: string, trigger: string): Observable<Cascade> {
    return this.guard(
      this.http.post<Cascade>(`${this.session(sessionId)}/analyses/cascade`, { trigger }),
    );
  }

  private session(sessionId: string): string {
    return `/api/sessions/${encodeURIComponent(sessionId)}`;
  }

  private guard<T>(request: Observable<T>): Observable<T> {
    return request.pipe(catchError((error: unknown) => throwError(() => toApiError(error))));
  }
}
