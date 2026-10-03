import { PerspectiveCamera } from 'three';

import { FakeRenderer, ManualScheduler, StubLabels } from '../testing/scene-fakes';
import { allSwitchPositions, fullSubstation } from '../testing/substation-fixture';
import { branchState, busState } from '../testing/fixtures';
import type { Position } from '../model/api-types';
import { buildSceneContents } from './scene-builders';
import { SceneHost } from './scene-host';
import { buildScenePlan } from './scene-plan';
import { buildSceneState } from './scene-state';

const substation = fullSubstation();
const plan = buildScenePlan(substation);

function stateOf(positions: Record<string, Position> = {}) {
  const merged = allSwitchPositions(substation);
  Object.entries(positions).forEach(([id, position]) => {
    merged.set(id, position);
  });
  return buildSceneState({
    plan,
    substation,
    nodeStates: new Map(substation.nodes.map((node) => [node, 'ENERGIZED' as const])),
    positions: merged,
    branches: new Map([['L2-4', branchState({ id: 'L2-4', from: 2, to: 4 })]]),
    buses: new Map([[4, busState({ number: 4 })]]),
    selection: null,
    hover: null,
    operable: true,
  });
}

function create() {
  const renderer = new FakeRenderer();
  const scheduler = new ManualScheduler();
  const host = new SceneHost({
    renderer,
    contents: buildSceneContents(plan, new StubLabels()),
    plan,
    environment: null,
    scheduler,
  });
  return { renderer, scheduler, host };
}

describe('SceneHost', () => {
  it('renders on demand, once per request', () => {
    const { renderer, scheduler, host } = create();
    expect(scheduler.pending).toBe(1);
    host.requestRender();
    host.requestRender();
    expect(scheduler.pending).toBe(1);
    scheduler.run();
    expect(renderer.renders).toBe(1);
    expect(scheduler.pending).toBe(0);
  });

  it('applies a state and renders it, then stays idle once the blades settle', () => {
    const { renderer, scheduler, host } = create();
    host.setState(stateOf());
    scheduler.run();
    const settled = renderer.renders;
    host.setState(stateOf({ 'L3-4.QA1': 'OPEN' }));
    expect(host.currentState?.equipment.get('L3-4.QA1')?.position).toBe('OPEN');
    const ticks = scheduler.run();
    expect(ticks).toBeGreaterThan(2);
    expect(renderer.renders).toBeGreaterThan(settled + 2);
    expect(host.contents.isAnimating()).toBe(false);
    expect(scheduler.pending).toBe(0);
  });

  it('resizes the renderer and the camera and ignores empty sizes', () => {
    const { renderer, host } = create();
    host.resize(800, 400, 2);
    expect(renderer.sizes).toEqual([{ width: 800, height: 400, pixelRatio: 2 }]);
    expect(host.camera.aspect).toBe(2);
    host.resize(0, 400, 1);
    host.resize(800, 0, 1);
    expect(renderer.sizes).toHaveLength(1);
  });

  it('moves the camera between the home view, the top view and a focused view', () => {
    const { host } = create();
    const home = host.camera.position.clone();
    host.topView();
    expect(host.camera.position.y).toBeGreaterThan(home.y);
    host.resetView();
    expect(host.camera.position.distanceTo(home)).toBeLessThan(0.001);
    expect(host.focusOn('CPL.QA1')).toBe(true);
    const target = host.contents.centerOf('CPL.QA1');
    expect(target).not.toBeNull();
    expect(host.camera.position.distanceTo(target ?? home)).toBeLessThan(30);
    expect(host.focusOn('nothing')).toBe(false);
  });

  it('projects equipment to the screen and picks it back', () => {
    const { host } = create();
    host.resize(800, 450, 1);
    host.camera.updateMatrixWorld();
    const roundTrips = plan.hits.filter((hit) => {
      const point = host.screenPointOf(hit.id);
      return point !== null && host.pick(point.clientX, point.clientY) === hit.id;
    });
    expect(roundTrips.length).toBeGreaterThan(plan.hits.length / 2);
    expect(host.screenPointOf('nothing')).toBeNull();
  });

  it('picks nothing at the very top of an empty sky and on a canvas without size', () => {
    const { renderer, host } = create();
    expect(host.pick(410, 21)).toBeNull();
    renderer.canvas.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
    expect(host.pick(10, 10)).toBeNull();
  });

  it('measures how much of a frame the scene covers and fingerprints it', () => {
    const { renderer, host } = create();
    const empty = new Uint8Array(4 * 4 * 4).fill(100);
    const drawn = new Uint8Array(empty);
    for (let index = 0; index < 8; index += 1) {
      drawn[index * 4] = 220;
    }
    renderer.frames = [
      { width: 4, height: 4, data: empty },
      { width: 4, height: 4, data: drawn },
    ];
    const stats = host.frameStats();
    expect(stats?.nonBackgroundRatio).toBeCloseTo(0.5);
    expect(stats?.hash).toMatch(/^[0-9a-f]+$/);
    expect(stats?.renderer).toBe('fake renderer');
    renderer.frames = [
      { width: 4, height: 4, data: empty },
      { width: 4, height: 4, data: new Uint8Array(empty) },
    ];
    expect(host.frameStats()?.nonBackgroundRatio).toBe(0);
  });

  it('returns no statistics when the renderer cannot read pixels', () => {
    const { host } = create();
    expect(host.frameStats()).toBeNull();
  });

  it('measures frame times while orbiting and then restores the size', async () => {
    const { renderer, scheduler, host } = create();
    host.resize(800, 450, 1);
    const before = host.camera.position.clone();
    const pending = host.measureFrames({ width: 640, height: 360, durationMs: 160 });
    scheduler.run();
    const result = await pending;
    expect(result.width).toBe(640);
    expect(result.frames).toBeGreaterThanOrEqual(8);
    expect(result.averageFps).toBeCloseTo(62.5, 0);
    expect(result.medianFrameMs).toBe(16);
    expect(result.p95FrameMs).toBe(16);
    expect(result.renderer).toBe('fake renderer');
    expect(renderer.sizes.some((size) => size.width === 640 && size.pixelRatio === 1)).toBe(true);
    expect(renderer.sizes[renderer.sizes.length - 1]).toEqual({
      width: 800,
      height: 450,
      pixelRatio: 1,
    });
    expect(host.camera.position.distanceTo(before)).toBeLessThan(0.001);
  });

  it('ignores resizes while measuring', async () => {
    const { renderer, scheduler, host } = create();
    const pending = host.measureFrames({ durationMs: 32 });
    host.resize(500, 300, 1);
    scheduler.run();
    await pending;
    expect(renderer.sizes.some((size) => size.width === 500)).toBe(false);
  });

  it('stops rendering after dispose', () => {
    const { renderer, scheduler, host } = create();
    host.dispose();
    expect(renderer.disposed).toBe(true);
    expect(scheduler.pending).toBe(0);
    host.requestRender();
    expect(scheduler.pending).toBe(0);
  });

  it('uses a perspective camera that looks at the substation', () => {
    const { host } = create();
    expect(host.camera).toBeInstanceOf(PerspectiveCamera);
    expect(host.controls.target.y).toBeGreaterThan(0);
  });
});
