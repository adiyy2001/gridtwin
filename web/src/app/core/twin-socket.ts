import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { DEFAULT_BACKOFF, backoffDelayMs, hasAttemptsLeft } from './backoff';
import type { VersionedState } from '../model/api-types';

export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'lost';

export interface SocketEvent {
  readonly status: SocketStatus;
  readonly message?: VersionedState;
}

const UNKNOWN_SESSION_CLOSE_CODE = 1008;

export type SocketFactory = (url: string) => WebSocket;

export const SOCKET_FACTORY = new InjectionToken<SocketFactory>('SOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (url: string) => new WebSocket(url),
});

export const SOCKET_BASE_URL = new InjectionToken<string>('SOCKET_BASE_URL', {
  providedIn: 'root',
  factory: () => {
    const secure = location.protocol === 'https:';
    return `${secure ? 'wss' : 'ws'}://${location.host}`;
  },
});

export function parseStateMessage(raw: unknown): VersionedState | null {
  if (typeof raw !== 'string') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'version' in parsed && 'state' in parsed) {
      return parsed as VersionedState;
    }
    return null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class TwinSocket {
  private readonly factory = inject(SOCKET_FACTORY);
  private readonly baseUrl = inject(SOCKET_BASE_URL);

  connect(sessionId: string): Observable<SocketEvent> {
    return new Observable<SocketEvent>((subscriber) => {
      let socket: WebSocket | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let attempt = 0;
      let closedByConsumer = false;

      const scheduleReconnect = (): void => {
        attempt += 1;
        if (!hasAttemptsLeft(attempt, DEFAULT_BACKOFF)) {
          subscriber.next({ status: 'lost' });
          subscriber.complete();
          return;
        }
        subscriber.next({ status: 'reconnecting' });
        timer = setTimeout(open, backoffDelayMs(attempt, DEFAULT_BACKOFF));
      };

      const open = (): void => {
        timer = null;
        const current = this.factory(
          `${this.baseUrl}/ws/sessions/${encodeURIComponent(sessionId)}`,
        );
        socket = current;
        current.addEventListener('open', () => {
          attempt = 0;
          subscriber.next({ status: 'open' });
        });
        current.addEventListener('message', (event: MessageEvent) => {
          const message = parseStateMessage(event.data);
          if (message !== null) {
            subscriber.next({ status: 'open', message });
          }
        });
        current.addEventListener('close', (event: CloseEvent) => {
          if (closedByConsumer || socket !== current) {
            return;
          }
          if (event.code === UNKNOWN_SESSION_CLOSE_CODE) {
            subscriber.next({ status: 'lost' });
            subscriber.complete();
            return;
          }
          scheduleReconnect();
        });
      };

      subscriber.next({ status: 'connecting' });
      open();

      return () => {
        closedByConsumer = true;
        if (timer !== null) {
          clearTimeout(timer);
        }
        socket?.close();
      };
    });
  }
}
