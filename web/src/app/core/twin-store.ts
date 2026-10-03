import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DestroyRef, computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import type { Subscription } from 'rxjs';

import { toApiError } from './api-error';
import { TwinApi } from './twin-api';
import { TwinSocket } from './twin-socket';
import type { SocketStatus } from './twin-socket';
import { clampStepIndex, resolveView } from './twin-view';
import type { ViewSource } from './twin-view';
import { acceptsVersion } from './version-gate';
import type {
  Cascade,
  CaseDetail,
  ContingencyPreview,
  ContingencyReport,
  Position,
  TwinState,
  VersionedState,
} from '../model/api-types';
import type { Selection } from '../model/selection';
import { branchSelection, busSelection } from '../model/selection';
import { cascadeEndLabel, formatPercent } from '../shared/format';

export type ConnectionStatus = 'idle' | SocketStatus;

export interface PendingSwitch {
  readonly switchId: string;
  readonly position: Position;
}

export interface Notice {
  readonly id: number;
  readonly tone: 'info' | 'error';
  readonly text: string;
}

interface TwinStoreState {
  caseDetail: CaseDetail | null;
  sessionId: string | null;
  version: number;
  live: TwinState | null;
  connection: ConnectionStatus;
  starting: boolean;
  busy: boolean;
  selection: Selection | null;
  hover: Selection | null;
  pending: PendingSwitch | null;
  loadPercent: number;
  report: ContingencyReport | null;
  preview: ContingencyPreview | null;
  cascade: Cascade | null;
  cascadeIndex: number;
  viewMode: ViewSource;
  cascadePlaying: boolean;
  notice: Notice | null;
}

const INITIAL_STATE: TwinStoreState = {
  caseDetail: null,
  sessionId: null,
  version: 0,
  live: null,
  connection: 'idle',
  starting: false,
  busy: false,
  selection: null,
  hover: null,
  pending: null,
  loadPercent: 100,
  report: null,
  preview: null,
  cascade: null,
  cascadeIndex: 0,
  viewMode: 'live',
  cascadePlaying: false,
  notice: null,
};

export const DEFAULT_CASE_ID = 'ieee14';
export const LOAD_PERCENT_MIN = 50;
export const LOAD_PERCENT_MAX = 150;
export const LOAD_COMMIT_DELAY_MS = 300;
export const CASCADE_STEP_DELAY_MS = 1000;

function clampLoadPercent(percent: number): number {
  return Math.min(LOAD_PERCENT_MAX, Math.max(LOAD_PERCENT_MIN, Math.round(percent)));
}

function describeOutcome(state: TwinState): string {
  if (!state.converged) {
    return 'the power flow did not converge';
  }
  const { maxLoading, overloadedBranches } = state.summary;
  const overloads =
    overloadedBranches === 0
      ? 'no overloaded branch'
      : `${overloadedBranches} overloaded ${overloadedBranches === 1 ? 'branch' : 'branches'}`;
  return `highest branch loading ${formatPercent(maxLoading)}, ${overloads}`;
}

export const TwinStore = signalStore(
  { providedIn: 'root' },
  withState(INITIAL_STATE),
  withComputed((store) => {
    const view = computed(() =>
      resolveView({
        mode: store.viewMode(),
        live: store.live(),
        preview: store.preview(),
        cascade: store.cascade(),
        cascadeIndex: store.cascadeIndex(),
      }),
    );
    const state = computed(() => view().state);
    const busesByNumber = computed(
      () => new Map((state()?.buses ?? []).map((bus) => [bus.number, bus])),
    );
    const branchesById = computed(
      () => new Map((state()?.branches ?? []).map((branch) => [branch.id, branch])),
    );
    const switchPositions = computed(
      () => new Map((store.live()?.switches ?? []).map((entry) => [entry.id, entry.position])),
    );
    return {
      view,
      state,
      busesByNumber,
      branchesById,
      switchPositions,
      selectedBus: computed(() => {
        const selection = store.selection();
        return selection?.kind === 'bus'
          ? (busesByNumber().get(Number(selection.id)) ?? null)
          : null;
      }),
      selectedBranch: computed(() => {
        const selection = store.selection();
        return selection?.kind === 'branch' ? (branchesById().get(selection.id) ?? null) : null;
      }),
      outageOptions: computed(() => {
        const detail = store.caseDetail();
        if (detail === null) {
          return [];
        }
        return [
          ...detail.branches.map((branch) => ({
            id: `branch:${branch.id}`,
            label: `Branch ${branch.id}`,
          })),
          ...detail.generators.map((generator) => ({
            id: `generator:${generator.id}`,
            label: `Generator ${generator.id}`,
          })),
        ];
      }),
      cascadeLastIndex: computed(() => Math.max((store.cascade()?.steps.length ?? 1) - 1, 0)),
      isLive: computed(() => view().source === 'live'),
    };
  }),
  withMethods((store) => {
    const api = inject(TwinApi);
    const socket = inject(TwinSocket);
    const announcer = inject(LiveAnnouncer);
    const destroyRef = inject(DestroyRef);

    let subscription: Subscription | null = null;
    let loadTimer: ReturnType<typeof setTimeout> | null = null;
    let playTimer: ReturnType<typeof setInterval> | null = null;
    let noticeCounter = 0;

    function notify(tone: Notice['tone'], text: string): void {
      noticeCounter += 1;
      patchState(store, { notice: { id: noticeCounter, tone, text } });
      void announcer.announce(text, tone === 'error' ? 'assertive' : 'polite');
    }

    function stopPlaying(): void {
      if (playTimer !== null) {
        clearInterval(playTimer);
        playTimer = null;
      }
      patchState(store, { cascadePlaying: false });
    }

    function clearAnalyses(): void {
      stopPlaying();
      patchState(store, {
        report: null,
        preview: null,
        cascade: null,
        cascadeIndex: 0,
        viewMode: 'live',
      });
    }

    function applyVersioned(message: VersionedState): boolean {
      if (!acceptsVersion(store.version(), message.version)) {
        return false;
      }
      const stale =
        (store.report() !== null && store.report()?.stateVersion !== message.version) ||
        (store.cascade() !== null && store.cascade()?.stateVersion !== message.version);
      if (stale) {
        clearAnalyses();
      }
      patchState(store, {
        version: message.version,
        live: message.state,
        loadPercent: clampLoadPercent(message.state.loadFactor * 100),
      });
      return true;
    }

    function listen(sessionId: string): void {
      subscription?.unsubscribe();
      subscription = socket.connect(sessionId).subscribe((event) => {
        patchState(store, { connection: event.status });
        if (event.message !== undefined) {
          applyVersioned(event.message);
        }
      });
    }

    async function guarded(action: () => Promise<void>): Promise<void> {
      patchState(store, { busy: true });
      try {
        await action();
      } catch (error: unknown) {
        notify('error', toApiError(error).message);
      } finally {
        patchState(store, { busy: false });
      }
    }

    function requireSession(): string | null {
      const sessionId = store.sessionId();
      if (sessionId === null) {
        notify('error', 'There is no session yet.');
      }
      return sessionId;
    }

    async function commitLoad(): Promise<void> {
      const sessionId = requireSession();
      if (sessionId === null) {
        return;
      }
      const percent = store.loadPercent();
      await guarded(async () => {
        const result = await firstValueFrom(api.setLoadFactor(sessionId, percent / 100));
        applyVersioned(result);
        notify('info', `Load at ${percent}%: ${describeOutcome(result.state)}.`);
      });
    }

    destroyRef.onDestroy(() => {
      subscription?.unsubscribe();
      if (loadTimer !== null) {
        clearTimeout(loadTimer);
      }
      stopPlaying();
    });

    return {
      async start(caseId: string = DEFAULT_CASE_ID): Promise<void> {
        patchState(store, { ...INITIAL_STATE, starting: true, connection: 'connecting' });
        try {
          const [detail, created] = await Promise.all([
            firstValueFrom(api.getCase(caseId)),
            firstValueFrom(api.createSession(caseId)),
          ]);
          patchState(store, { caseDetail: detail, sessionId: created.sessionId });
          applyVersioned(created.state);
          listen(created.sessionId);
        } catch (error: unknown) {
          patchState(store, { connection: 'lost' });
          notify('error', toApiError(error).message);
        } finally {
          patchState(store, { starting: false });
        }
      },

      select(selection: Selection | null): void {
        patchState(store, { selection });
      },

      selectBus(number: number): void {
        patchState(store, { selection: busSelection(number) });
      },

      selectBranch(id: string): void {
        patchState(store, { selection: branchSelection(id) });
      },

      setHover(selection: Selection | null): void {
        patchState(store, { hover: selection });
      },

      requestSwitch(switchId: string, position: Position): void {
        patchState(store, { pending: { switchId, position } });
      },

      cancelPending(): void {
        patchState(store, { pending: null });
      },

      async confirmPending(): Promise<void> {
        const pending = store.pending();
        const sessionId = requireSession();
        patchState(store, { pending: null });
        if (pending === null || sessionId === null) {
          return;
        }
        await guarded(async () => {
          const result = await firstValueFrom(
            api.operateSwitch(sessionId, pending.switchId, pending.position),
          );
          applyVersioned(result);
          const verb = pending.position === 'OPEN' ? 'opened' : 'closed';
          notify('info', `${pending.switchId} ${verb}: ${describeOutcome(result.state)}.`);
        });
      },

      setLoadPercent(percent: number): void {
        patchState(store, { loadPercent: clampLoadPercent(percent) });
        if (loadTimer !== null) {
          clearTimeout(loadTimer);
        }
        loadTimer = setTimeout(() => {
          loadTimer = null;
          void commitLoad();
        }, LOAD_COMMIT_DELAY_MS);
      },

      async runContingencies(): Promise<void> {
        const sessionId = requireSession();
        if (sessionId === null) {
          return;
        }
        await guarded(async () => {
          const report = await firstValueFrom(api.runContingencies(sessionId));
          stopPlaying();
          patchState(store, {
            report,
            preview: null,
            cascade: null,
            cascadeIndex: 0,
            viewMode: 'live',
          });
          notify(
            'info',
            `N-1 finished: ${report.contingencies.length} outages ranked, ${report.tiers.secure} secure.`,
          );
        });
      },

      async previewContingency(contingencyId: string): Promise<void> {
        const sessionId = requireSession();
        if (sessionId === null) {
          return;
        }
        await guarded(async () => {
          const preview = await firstValueFrom(api.previewContingency(sessionId, contingencyId));
          stopPlaying();
          patchState(store, { preview, viewMode: 'preview' });
          notify(
            'info',
            `Previewing the outage of ${preview.contingency.outage.equipmentId}, ${describeOutcome(preview.state)}.`,
          );
        });
      },

      async runCascade(trigger: string): Promise<void> {
        const sessionId = requireSession();
        if (sessionId === null) {
          return;
        }
        await guarded(async () => {
          const cascade = await firstValueFrom(api.runCascade(sessionId, trigger));
          stopPlaying();
          patchState(store, { cascade, cascadeIndex: 0, viewMode: 'cascade' });
          notify(
            'info',
            `Cascade finished after ${cascade.trippedCount} ${cascade.trippedCount === 1 ? 'trip' : 'trips'}, ended with ${cascadeEndLabel(cascade.end)}.`,
          );
        });
      },

      setCascadeIndex(index: number): void {
        patchState(store, {
          cascadeIndex: clampStepIndex(store.cascade(), index),
          viewMode: 'cascade',
        });
      },

      playCascade(): void {
        const cascade = store.cascade();
        if (cascade === null || playTimer !== null) {
          return;
        }
        const restart = store.cascadeIndex() >= cascade.steps.length - 1;
        patchState(store, {
          cascadeIndex: restart ? 0 : store.cascadeIndex(),
          viewMode: 'cascade',
          cascadePlaying: true,
        });
        playTimer = setInterval(() => {
          const next = store.cascadeIndex() + 1;
          patchState(store, { cascadeIndex: clampStepIndex(store.cascade(), next) });
          if (next >= (store.cascade()?.steps.length ?? 0) - 1) {
            stopPlaying();
          }
        }, CASCADE_STEP_DELAY_MS);
      },

      pauseCascade(): void {
        stopPlaying();
      },

      showLive(): void {
        stopPlaying();
        patchState(store, { viewMode: 'live' });
      },

      dismissNotice(): void {
        patchState(store, { notice: null });
      },
    };
  }),
);
