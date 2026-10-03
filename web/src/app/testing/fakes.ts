import { Observable, Subject, of, throwError } from 'rxjs';

import { ApiError } from '../core/api-error';
import type { SocketEvent } from '../core/twin-socket';
import type {
  Cascade,
  CaseDetail,
  ContingencyPreview,
  ContingencyReport,
  Position,
  SessionCreated,
  VersionedState,
} from '../model/api-types';
import {
  cascade,
  caseDetail,
  contingencyPreview,
  contingencyReport,
  sessionCreated,
  versioned,
} from './fixtures';

export class FakeApi {
  detail: CaseDetail = caseDetail();
  created: SessionCreated = sessionCreated();
  failure: ApiError | null = null;
  report: ContingencyReport = contingencyReport();
  preview: ContingencyPreview = contingencyPreview();
  cascadeResult: Cascade = cascade();
  nextVersion = 2;
  readonly calls: string[] = [];

  getCase(caseId: string): Observable<CaseDetail> {
    this.calls.push(`getCase ${caseId}`);
    return this.respond(this.detail);
  }

  createSession(caseId: string): Observable<SessionCreated> {
    this.calls.push(`createSession ${caseId}`);
    return this.respond(this.created);
  }

  operateSwitch(sessionId: string, switchId: string, position: Position): Observable<VersionedState> {
    this.calls.push(`operateSwitch ${sessionId} ${switchId} ${position}`);
    return this.respond(this.advance());
  }

  setLoadFactor(sessionId: string, loadFactor: number): Observable<VersionedState> {
    this.calls.push(`setLoadFactor ${sessionId} ${loadFactor}`);
    return this.respond(this.advance(loadFactor));
  }

  runContingencies(sessionId: string): Observable<ContingencyReport> {
    this.calls.push(`runContingencies ${sessionId}`);
    return this.respond(this.report);
  }

  previewContingency(sessionId: string, contingencyId: string): Observable<ContingencyPreview> {
    this.calls.push(`previewContingency ${sessionId} ${contingencyId}`);
    return this.respond(this.preview);
  }

  runCascade(sessionId: string, trigger: string): Observable<Cascade> {
    this.calls.push(`runCascade ${sessionId} ${trigger}`);
    return this.respond(this.cascadeResult);
  }

  private advance(loadFactor = 1): VersionedState {
    const version = this.nextVersion;
    this.nextVersion += 1;
    const base = versioned(version);
    return { ...base, state: { ...base.state, loadFactor } };
  }

  private respond<T>(value: T): Observable<T> {
    if (this.failure !== null) {
      return throwError(() => this.failure);
    }
    return of(value);
  }
}

export class FakeSocket {
  readonly events = new Subject<SocketEvent>();
  readonly connected: string[] = [];

  connect(sessionId: string): Observable<SocketEvent> {
    this.connected.push(sessionId);
    return this.events.asObservable();
  }
}
