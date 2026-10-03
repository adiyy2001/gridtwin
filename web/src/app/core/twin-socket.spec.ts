import { TestBed } from '@angular/core/testing';

import { DEFAULT_BACKOFF } from './backoff';
import { SOCKET_BASE_URL, SOCKET_FACTORY, TwinSocket, parseStateMessage } from './twin-socket';
import type { SocketEvent } from './twin-socket';
import { versioned } from '../testing/fixtures';

class FakeWebSocket extends EventTarget {
  closed = false;

  constructor(readonly url: string) {
    super();
  }

  close(): void {
    this.closed = true;
  }

  open(): void {
    this.dispatchEvent(new Event('open'));
  }

  receive(data: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }

  drop(code = 1006): void {
    const event = new Event('close') as CloseEvent;
    Object.defineProperty(event, 'code', { value: code });
    this.dispatchEvent(event);
  }
}

describe('parseStateMessage', () => {
  it('parses a versioned state', () => {
    const message = parseStateMessage(JSON.stringify(versioned(3)));
    expect(message?.version).toBe(3);
  });

  it('returns null for text that is not JSON', () => {
    expect(parseStateMessage('{')).toBeNull();
  });

  it('returns null for JSON without a state', () => {
    expect(parseStateMessage('{"version":1}')).toBeNull();
  });

  it('returns null for JSON that is not an object', () => {
    expect(parseStateMessage('7')).toBeNull();
  });

  it('returns null for binary data', () => {
    expect(parseStateMessage(new ArrayBuffer(2))).toBeNull();
  });
});

describe('TwinSocket', () => {
  let sockets: FakeWebSocket[];
  let events: SocketEvent[];
  let socket: TwinSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    events = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SOCKET_FACTORY,
          useValue: (url: string) => {
            const created = new FakeWebSocket(url);
            sockets.push(created);
            return created as unknown as WebSocket;
          },
        },
        { provide: SOCKET_BASE_URL, useValue: 'ws://host' },
      ],
    });
    socket = TestBed.inject(TwinSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function statuses(): string[] {
    return events.map((event) => event.status);
  }

  it('connects to the session path and reports the lifecycle', () => {
    socket.connect('abc').subscribe((event) => events.push(event));
    expect(sockets[0]?.url).toBe('ws://host/ws/sessions/abc');
    sockets[0]?.open();
    sockets[0]?.receive(JSON.stringify(versioned(1)));
    expect(statuses()).toEqual(['connecting', 'open', 'open']);
    expect(events[2]?.message?.version).toBe(1);
  });

  it('ignores messages that are not states', () => {
    socket.connect('abc').subscribe((event) => events.push(event));
    sockets[0]?.open();
    sockets[0]?.receive('nonsense');
    expect(events.filter((event) => event.message !== undefined)).toHaveLength(0);
  });

  it('reconnects after a drop with a growing delay', () => {
    socket.connect('abc').subscribe((event) => events.push(event));
    sockets[0]?.open();
    sockets[0]?.drop();
    expect(statuses().at(-1)).toBe('reconnecting');
    vi.advanceTimersByTime(DEFAULT_BACKOFF.initialDelayMs - 1);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
    sockets[1]?.drop();
    vi.advanceTimersByTime(DEFAULT_BACKOFF.initialDelayMs * 2);
    expect(sockets).toHaveLength(3);
  });

  it('starts counting again after a successful connection', () => {
    socket.connect('abc').subscribe((event) => events.push(event));
    sockets[0]?.drop();
    vi.advanceTimersByTime(DEFAULT_BACKOFF.initialDelayMs);
    sockets[1]?.open();
    sockets[1]?.drop();
    vi.advanceTimersByTime(DEFAULT_BACKOFF.initialDelayMs);
    expect(sockets).toHaveLength(3);
  });

  it('gives up after the maximum number of attempts', () => {
    let completed = false;
    socket.connect('abc').subscribe({
      next: (event) => events.push(event),
      complete: () => (completed = true),
    });
    for (let attempt = 0; attempt <= DEFAULT_BACKOFF.maxAttempts; attempt += 1) {
      sockets.at(-1)?.drop();
      vi.advanceTimersByTime(DEFAULT_BACKOFF.maxDelayMs);
    }
    expect(statuses().at(-1)).toBe('lost');
    expect(completed).toBe(true);
  });

  it('is lost at once when the server does not know the session', () => {
    let completed = false;
    socket.connect('abc').subscribe({
      next: (event) => events.push(event),
      complete: () => (completed = true),
    });
    sockets[0]?.drop(1008);
    expect(statuses().at(-1)).toBe('lost');
    expect(completed).toBe(true);
    vi.advanceTimersByTime(DEFAULT_BACKOFF.maxDelayMs);
    expect(sockets).toHaveLength(1);
  });

  it('closes the socket and stops reconnecting on unsubscribe', () => {
    const subscription = socket.connect('abc').subscribe((event) => events.push(event));
    sockets[0]?.drop();
    subscription.unsubscribe();
    vi.advanceTimersByTime(DEFAULT_BACKOFF.maxDelayMs);
    expect(sockets).toHaveLength(1);
  });

  it('closes an open socket on unsubscribe', () => {
    const subscription = socket.connect('abc').subscribe((event) => events.push(event));
    subscription.unsubscribe();
    expect(sockets[0]?.closed).toBe(true);
  });
});
