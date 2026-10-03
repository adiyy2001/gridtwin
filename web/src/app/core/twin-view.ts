import type { Cascade, CascadeStep, ContingencyPreview, TwinState } from '../model/api-types';

export type ViewSource = 'live' | 'preview' | 'cascade';

export interface ViewInput {
  readonly mode: ViewSource;
  readonly live: TwinState | null;
  readonly preview: ContingencyPreview | null;
  readonly cascade: Cascade | null;
  readonly cascadeIndex: number;
}

export interface TwinView {
  readonly source: ViewSource;
  readonly state: TwinState | null;
  readonly description: string | null;
}

export function clampStepIndex(cascade: Cascade | null, index: number): number {
  if (cascade === null || cascade.steps.length === 0) {
    return 0;
  }
  return Math.min(Math.max(Math.trunc(index), 0), cascade.steps.length - 1);
}

export function resolveView(input: ViewInput): TwinView {
  if (input.mode === 'cascade' && input.cascade !== null && input.cascade.steps.length > 0) {
    const index = clampStepIndex(input.cascade, input.cascadeIndex);
    const step = input.cascade.steps[index];
    if (step !== undefined) {
      const tripped = step.tripped;
      const description = tripped
        ? `Cascade replay, step ${step.index}: ${tripped.equipmentId} tripped`
        : 'Cascade replay, step 0: the state before any trip';
      return { source: 'cascade', state: step.state, description };
    }
  }
  if (input.mode === 'preview' && input.preview !== null) {
    return {
      source: 'preview',
      state: input.preview.state,
      description: `Preview of the outage ${input.preview.contingency.outage.equipmentId}, not applied`,
    };
  }
  return { source: 'live', state: input.live, description: null };
}

export function stepTripLabel(step: CascadeStep): string {
  return step.tripped ? `trip ${step.tripped.equipmentId}` : 'start';
}

export function cascadeStepLabel(cascade: Cascade, index: number): string {
  const step = cascade.steps[clampStepIndex(cascade, index)];
  return step === undefined ? 'no steps' : stepTripLabel(step);
}
