import { cascadeStepLabel, clampStepIndex, resolveView, stepTripLabel } from './twin-view';
import { cascade, contingencyPreview, twinState } from '../testing/fixtures';

describe('resolveView', () => {
  const live = twinState();
  const preview = contingencyPreview();
  const replay = cascade();

  it('shows the live state in live mode', () => {
    const view = resolveView({ mode: 'live', live, preview, cascade: replay, cascadeIndex: 1 });
    expect(view.source).toBe('live');
    expect(view.state).toBe(live);
    expect(view.description).toBeNull();
  });

  it('shows the preview in preview mode', () => {
    const view = resolveView({ mode: 'preview', live, preview, cascade: null, cascadeIndex: 0 });
    expect(view.source).toBe('preview');
    expect(view.state).toBe(preview.state);
    expect(view.description).toContain('L1-2');
  });

  it('shows the selected step in cascade mode', () => {
    const view = resolveView({ mode: 'cascade', live, preview: null, cascade: replay, cascadeIndex: 1 });
    expect(view.source).toBe('cascade');
    expect(view.state).toBe(replay.steps[1]?.state);
    expect(view.description).toContain('L2-4 tripped');
  });

  it('describes the first step as the state before any trip', () => {
    const view = resolveView({ mode: 'cascade', live, preview: null, cascade: replay, cascadeIndex: 0 });
    expect(view.description).toContain('before any trip');
  });

  it('falls back to the live state when the preview is missing', () => {
    const view = resolveView({ mode: 'preview', live, preview: null, cascade: null, cascadeIndex: 0 });
    expect(view.source).toBe('live');
  });

  it('falls back to the live state when the cascade has no steps', () => {
    const empty = { ...replay, steps: [] };
    const view = resolveView({ mode: 'cascade', live, preview: null, cascade: empty, cascadeIndex: 0 });
    expect(view.source).toBe('live');
  });

  it('has no state before the first one arrives', () => {
    const view = resolveView({ mode: 'live', live: null, preview: null, cascade: null, cascadeIndex: 0 });
    expect(view.state).toBeNull();
  });
});

describe('cascade steps', () => {
  const replay = cascade();

  it('clamps the index into the range of steps', () => {
    expect(clampStepIndex(replay, -4)).toBe(0);
    expect(clampStepIndex(replay, 99)).toBe(2);
    expect(clampStepIndex(replay, 1.7)).toBe(1);
  });

  it('clamps to zero without a cascade', () => {
    expect(clampStepIndex(null, 3)).toBe(0);
  });

  it('labels the steps', () => {
    expect(cascadeStepLabel(replay, 0)).toBe('start');
    expect(cascadeStepLabel(replay, 1)).toBe('trip L2-4');
  });

  it('labels a cascade without steps', () => {
    expect(cascadeStepLabel({ ...replay, steps: [] }, 0)).toBe('no steps');
  });

  it('labels one step', () => {
    const first = replay.steps[1];
    expect(first === undefined ? '' : stepTripLabel(first)).toBe('trip L2-4');
  });
});
