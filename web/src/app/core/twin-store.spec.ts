import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiError } from './api-error';
import {
  CASCADE_STEP_DELAY_MS,
  LOAD_COMMIT_DELAY_MS,
  LOAD_PERCENT_MAX,
  LOAD_PERCENT_MIN,
  TwinStore,
} from './twin-store';
import { TwinApi } from './twin-api';
import { TwinSocket } from './twin-socket';
import { FakeApi, FakeSocket } from '../testing/fakes';
import { cascade, contingencyReport, twinState, versioned } from '../testing/fixtures';

describe('TwinStore', () => {
  let api: FakeApi;
  let socket: FakeSocket;
  let announcer: { announce: ReturnType<typeof vi.fn> };
  let store: InstanceType<typeof TwinStore>;

  beforeEach(() => {
    vi.useFakeTimers();
    api = new FakeApi();
    socket = new FakeSocket();
    announcer = { announce: vi.fn().mockResolvedValue(undefined) };
    TestBed.configureTestingModule({
      providers: [
        { provide: TwinApi, useValue: api },
        { provide: TwinSocket, useValue: socket },
        { provide: LiveAnnouncer, useValue: announcer },
      ],
    });
    store = TestBed.inject(TwinStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function started(): Promise<void> {
    await store.start();
  }

  describe('start', () => {
    it('loads the case, creates a session and listens to its socket', async () => {
      await started();
      expect(store.caseDetail()?.id).toBe('mini');
      expect(store.sessionId()).toBe('session-1');
      expect(store.version()).toBe(1);
      expect(store.live()).not.toBeNull();
      expect(socket.connected).toEqual(['session-1']);
      expect(store.starting()).toBe(false);
    });

    it('reports a failed start and marks the connection lost', async () => {
      api.failure = new ApiError(429, 'too-many-sessions', 'No more sessions.', null);
      await started();
      expect(store.connection()).toBe('lost');
      expect(store.notice()?.tone).toBe('error');
      expect(store.notice()?.text).toBe('No more sessions.');
      expect(announcer.announce).toHaveBeenCalledWith('No more sessions.', 'assertive');
    });

    it('starts over cleanly when it is called again', async () => {
      await started();
      store.selectBus(2);
      await started();
      expect(store.selection()).toBeNull();
      expect(socket.connected).toHaveLength(2);
    });
  });

  describe('socket messages', () => {
    beforeEach(started);

    it('applies a newer state and the connection status', () => {
      socket.events.next({ status: 'open', message: versioned(5, twinState({ loadFactor: 1.2 })) });
      expect(store.version()).toBe(5);
      expect(store.connection()).toBe('open');
      expect(store.loadPercent()).toBe(120);
    });

    it('ignores a state that is not newer', () => {
      socket.events.next({ status: 'open', message: versioned(5) });
      socket.events.next({
        status: 'open',
        message: versioned(4, twinState({ loadFactor: 1.5 })),
      });
      expect(store.version()).toBe(5);
      expect(store.live()?.loadFactor).toBe(1);
    });

    it('follows the status of a reconnecting socket', () => {
      socket.events.next({ status: 'reconnecting' });
      expect(store.connection()).toBe('reconnecting');
    });
  });

  describe('selection', () => {
    beforeEach(started);

    it('selects a bus and finds its state', () => {
      store.selectBus(2);
      expect(store.selectedBus()?.number).toBe(2);
      expect(store.selectedBranch()).toBeNull();
    });

    it('selects a branch and finds its state', () => {
      store.selectBranch('L2-4');
      expect(store.selectedBranch()?.id).toBe('L2-4');
      expect(store.selectedBus()).toBeNull();
    });

    it('selects a switch of the substation', () => {
      store.selectSwitch('L2-4.QA1');
      expect(store.selection()).toEqual({ kind: 'switch', id: 'L2-4.QA1' });
      expect(store.selectedSwitch()?.kind).toBe('BREAKER');
      expect(store.selectedBus()).toBeNull();
    });

    it('returns nothing for an unknown switch', () => {
      store.selectSwitch('nope');
      expect(store.selectedSwitch()).toBeNull();
    });

    it('clears the selection', () => {
      store.selectBus(2);
      store.select(null);
      expect(store.selection()).toBeNull();
    });

    it('returns nothing for an unknown bus', () => {
      store.selectBus(99);
      expect(store.selectedBus()).toBeNull();
    });

    it('tracks hover separately from the selection', () => {
      store.selectBus(2);
      store.setHover({ kind: 'branch', id: 'L1-2' });
      expect(store.hover()?.id).toBe('L1-2');
      expect(store.selection()?.id).toBe('2');
    });
  });

  describe('switch operations', () => {
    beforeEach(started);

    it('keeps a request pending until it is decided', () => {
      store.requestSwitch('CPL.QA1', 'OPEN');
      expect(store.pending()).toEqual({ switchId: 'CPL.QA1', position: 'OPEN' });
    });

    it('drops a cancelled request without calling the server', () => {
      store.requestSwitch('CPL.QA1', 'OPEN');
      store.cancelPending();
      expect(store.pending()).toBeNull();
      expect(api.calls.some((call) => call.startsWith('operateSwitch'))).toBe(false);
    });

    it('operates the switch after a confirmation and applies the new state', async () => {
      store.requestSwitch('CPL.QA1', 'OPEN');
      await store.confirmPending();
      expect(api.calls).toContain('operateSwitch session-1 CPL.QA1 OPEN');
      expect(store.version()).toBe(2);
      expect(store.pending()).toBeNull();
      expect(store.notice()?.text).toContain('CPL.QA1 opened');
      expect(store.busy()).toBe(false);
    });

    it('reports a closed switch in the notice', async () => {
      store.requestSwitch('CPL.QA1', 'CLOSED');
      await store.confirmPending();
      expect(store.notice()?.text).toContain('CPL.QA1 closed');
    });

    it('shows the reason when the server refuses', async () => {
      api.failure = new ApiError(409, 'interlock', 'Open the breaker first.', 'QB1');
      store.requestSwitch('QB1', 'CLOSED');
      await store.confirmPending();
      expect(store.notice()).toMatchObject({ tone: 'error', text: 'Open the breaker first.' });
      expect(store.version()).toBe(1);
      expect(store.busy()).toBe(false);
    });

    it('keeps the refusal for the inspector and clears it on the next request', async () => {
      api.failure = new ApiError(409, 'interlock', 'Open the breaker first.', 'QB1');
      store.requestSwitch('QB1', 'CLOSED');
      await store.confirmPending();
      expect(store.refusal()).toEqual({
        switchId: 'QB1',
        position: 'CLOSED',
        code: 'interlock',
        message: 'Open the breaker first.',
      });
      store.requestSwitch('QB1', 'OPEN');
      expect(store.refusal()).toBeNull();
    });

    it('does not record a refusal for other failures', async () => {
      api.failure = new ApiError(500, 'http-error', 'The server answered 500.', null);
      store.requestSwitch('QB1', 'CLOSED');
      await store.confirmPending();
      expect(store.refusal()).toBeNull();
      expect(store.notice()?.tone).toBe('error');
    });

    it('dismisses a refusal', async () => {
      api.failure = new ApiError(409, 'interlock', 'No.', 'QB1');
      store.requestSwitch('QB1', 'CLOSED');
      await store.confirmPending();
      store.dismissRefusal();
      expect(store.refusal()).toBeNull();
    });

    it('does nothing when there is nothing pending', async () => {
      await store.confirmPending();
      expect(api.calls.some((call) => call.startsWith('operateSwitch'))).toBe(false);
    });

    it('lists the switch positions of the live state', () => {
      expect(store.switchPositions().get('CPL.QA1')).toBe('CLOSED');
    });
  });

  describe('load factor', () => {
    beforeEach(started);

    it('clamps the percentage to the allowed range', () => {
      store.setLoadPercent(10);
      expect(store.loadPercent()).toBe(LOAD_PERCENT_MIN);
      store.setLoadPercent(500);
      expect(store.loadPercent()).toBe(LOAD_PERCENT_MAX);
    });

    it('sends one request after the user stops moving the slider', async () => {
      store.setLoadPercent(110);
      store.setLoadPercent(120);
      store.setLoadPercent(130);
      expect(api.calls.filter((call) => call.startsWith('setLoadFactor'))).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(LOAD_COMMIT_DELAY_MS);
      expect(api.calls.filter((call) => call.startsWith('setLoadFactor'))).toEqual([
        'setLoadFactor session-1 1.3',
      ]);
      expect(store.notice()?.text).toContain('Load at 130%');
    });

    it('describes a diverged power flow', async () => {
      store.requestSwitch('CPL.QA1', 'OPEN');
      const diverged = twinState({ converged: false });
      vi.spyOn(api, 'operateSwitch').mockReturnValue(of(versioned(2, diverged)));
      await store.confirmPending();
      expect(store.notice()?.text).toContain('did not converge');
    });

    it('describes overloaded branches in the outcome', async () => {
      const overloaded = twinState({
        summary: { ...twinState().summary, overloadedBranches: 2, maxLoading: 1.3 },
      });
      vi.spyOn(api, 'operateSwitch').mockReturnValue(of(versioned(2, overloaded)));
      store.requestSwitch('CPL.QA1', 'OPEN');
      await store.confirmPending();
      expect(store.notice()?.text).toContain('2 overloaded branches');
    });
  });

  describe('analyses', () => {
    beforeEach(started);

    it('keeps the N-1 report', async () => {
      await store.runContingencies();
      expect(store.report()?.contingencies).toHaveLength(3);
      expect(store.notice()?.text).toContain('N-1 finished');
    });

    it('previews one contingency and shows its state instead of the live one', async () => {
      await store.runContingencies();
      await store.previewContingency('branch:L1-2');
      expect(store.viewMode()).toBe('preview');
      expect(store.isLive()).toBe(false);
      expect(store.state()).toBe(store.preview()?.state);
      expect(store.view().description).toContain('not applied');
    });

    it('returns to the live state', async () => {
      await store.previewContingency('branch:L1-2');
      store.showLive();
      expect(store.isLive()).toBe(true);
      expect(store.state()).toBe(store.live());
    });

    it('runs a cascade and shows its first step', async () => {
      await store.runCascade('branch:L2-4');
      expect(api.calls).toContain('runCascade session-1 branch:L2-4');
      expect(store.viewMode()).toBe('cascade');
      expect(store.cascadeIndex()).toBe(0);
      expect(store.cascadeLastIndex()).toBe(2);
      expect(store.notice()?.text).toContain('2 trips');
    });

    it('uses the singular for one trip', async () => {
      api.cascadeResult = { ...cascade(), trippedCount: 1 };
      await store.runCascade('branch:L2-4');
      expect(store.notice()?.text).toContain('1 trip,');
    });

    it('moves the scrubber and clamps it', async () => {
      await store.runCascade('branch:L2-4');
      store.setCascadeIndex(2);
      expect(store.cascadeIndex()).toBe(2);
      store.setCascadeIndex(40);
      expect(store.cascadeIndex()).toBe(2);
      store.setCascadeIndex(-1);
      expect(store.cascadeIndex()).toBe(0);
    });

    it('plays the steps one by one and stops at the end', async () => {
      await store.runCascade('branch:L2-4');
      store.playCascade();
      expect(store.cascadePlaying()).toBe(true);
      await vi.advanceTimersByTimeAsync(CASCADE_STEP_DELAY_MS);
      expect(store.cascadeIndex()).toBe(1);
      await vi.advanceTimersByTimeAsync(CASCADE_STEP_DELAY_MS);
      expect(store.cascadeIndex()).toBe(2);
      expect(store.cascadePlaying()).toBe(false);
    });

    it('starts again from the beginning when it plays at the last step', async () => {
      await store.runCascade('branch:L2-4');
      store.setCascadeIndex(2);
      store.playCascade();
      expect(store.cascadeIndex()).toBe(0);
      expect(store.cascadePlaying()).toBe(true);
    });

    it('pauses', async () => {
      await store.runCascade('branch:L2-4');
      store.playCascade();
      store.pauseCascade();
      await vi.advanceTimersByTimeAsync(CASCADE_STEP_DELAY_MS * 3);
      expect(store.cascadeIndex()).toBe(0);
      expect(store.cascadePlaying()).toBe(false);
    });

    it('ignores play without a cascade', () => {
      store.playCascade();
      expect(store.cascadePlaying()).toBe(false);
    });

    it('forgets the results when the state changes', async () => {
      await store.runContingencies();
      await store.runCascade('branch:L2-4');
      socket.events.next({ status: 'open', message: versioned(2) });
      expect(store.report()).toBeNull();
      expect(store.cascade()).toBeNull();
      expect(store.viewMode()).toBe('live');
    });

    it('keeps the results that were computed for the state that arrives', async () => {
      api.report = contingencyReport(undefined, 2);
      await store.runContingencies();
      socket.events.next({ status: 'open', message: versioned(2) });
      expect(store.report()).not.toBeNull();
    });

    it('reports a failed analysis', async () => {
      api.failure = new ApiError(500, 'boom', 'The analysis failed.', null);
      await store.runContingencies();
      expect(store.notice()?.text).toBe('The analysis failed.');
      expect(store.busy()).toBe(false);
    });

    it('lists the outages that can start a cascade', () => {
      const ids = store.outageOptions().map((option) => option.id);
      expect(ids).toEqual(['branch:L1-2', 'branch:L2-4', 'generator:G1']);
    });
  });

  describe('without a session', () => {
    it('refuses to run an analysis', async () => {
      await store.runContingencies();
      await store.previewContingency('branch:L1-2');
      await store.runCascade('branch:L1-2');
      store.setLoadPercent(120);
      await vi.advanceTimersByTimeAsync(LOAD_COMMIT_DELAY_MS);
      expect(api.calls).toHaveLength(0);
      expect(store.notice()?.text).toBe('There is no session yet.');
    });

    it('has no outage options and no state', () => {
      expect(store.outageOptions()).toEqual([]);
      expect(store.state()).toBeNull();
      expect(store.busesByNumber().size).toBe(0);
    });

    it('dismisses a notice', () => {
      store.setLoadPercent(100);
      store.dismissNotice();
      expect(store.notice()).toBeNull();
    });
  });
});
