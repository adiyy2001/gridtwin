import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';

import { StatusBar } from './status-bar';
import { ApiError } from '../core/api-error';
import { TwinStore } from '../core/twin-store';
import { fakeTwin } from '../testing/providers';
import type { FakeTwin } from '../testing/providers';

describe('StatusBar', () => {
  let twin: FakeTwin;
  let fixture: ComponentFixture<StatusBar>;
  let store: InstanceType<typeof TwinStore>;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(testId: string): string {
    return element().querySelector(`[data-testid="${testId}"]`)?.textContent.trim() ?? '';
  }

  beforeEach(async () => {
    twin = fakeTwin();
    TestBed.configureTestingModule({ providers: twin.providers });
    store = TestBed.inject(TwinStore);
    fixture = TestBed.createComponent(StatusBar);
    await fixture.whenStable();
  });

  it('starts idle and ready', () => {
    expect(text('notice')).toBe('Ready.');
    expect(text('connection')).toBe('Not connected');
  });

  it('shows the live version once connected', async () => {
    await store.start();
    twin.socket.events.next({ status: 'open' });
    await fixture.whenStable();
    expect(text('connection')).toBe('Live, state version 1');
    expect(element().querySelector('[data-testid="connection"]')?.getAttribute('data-status')).toBe(
      'open',
    );
  });

  it('shows a reconnecting socket', async () => {
    await store.start();
    twin.socket.events.next({ status: 'reconnecting' });
    await fixture.whenStable();
    expect(text('connection')).toContain('reconnecting');
  });

  it('says it is connecting while the session is created', async () => {
    const pending = store.start();
    await fixture.whenStable();
    expect(text('connection')).toBe('Connecting');
    await pending;
  });

  it('shows a refusal with its reason', async () => {
    await store.start();
    twin.api.failure = new ApiError(409, 'interlock', 'Open the breaker first.', 'QB1');
    store.requestSwitch('QB1', 'CLOSED');
    await store.confirmPending();
    await fixture.whenStable();
    expect(text('notice')).toBe('Refused or failed: Open the breaker first.');
    expect(element().querySelector('.status')?.classList.contains('error')).toBe(true);
  });

  it('offers a new session when the connection is lost', async () => {
    twin.api.failure = new ApiError(0, 'unreachable', 'The server cannot be reached.', null);
    await store.start();
    await fixture.whenStable();
    expect(text('connection')).toContain('Disconnected');
    twin.api.failure = null;
    element().querySelector<HTMLButtonElement>('.connection button')?.click();
    await vi.waitFor(() => {
      expect(store.sessionId()).toBe('session-1');
    });
  });
});
