import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';

import { Diagnostics } from '../core/diagnostics';
import type { GridtwinGlobal } from '../core/diagnostics';
import { TwinStore } from '../core/twin-store';
import { caseDetail, sessionCreated, twinState } from '../testing/fixtures';
import { fakeTwin } from '../testing/providers';
import type { FakeTwin } from '../testing/providers';
import { FakeRenderer, ManualScheduler, StubLabels } from '../testing/scene-fakes';
import { allSwitchPositions, fullSubstation } from '../testing/substation-fixture';
import { SCENE_ENVIRONMENT } from './scene-environment';
import type { SceneEnvironment } from './scene-environment';
import type { SceneDiagnostics } from './scene-view';
import { SceneView } from './scene-view';

describe('SceneView', () => {
  let twin: FakeTwin;
  let fixture: ComponentFixture<SceneView>;
  let store: InstanceType<typeof TwinStore>;
  let scheduler: ManualScheduler;
  let renderers: FakeRenderer[];
  let webgl: boolean;
  let failing: boolean;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function api(): SceneDiagnostics {
    const global = (window as { __gridtwin?: GridtwinGlobal }).__gridtwin;
    return global?.['scene'] as SceneDiagnostics;
  }

  function canvas(): HTMLCanvasElement {
    const found = element().querySelector<HTMLCanvasElement>('[data-scene-canvas]');
    if (found === null) {
      throw new Error('no canvas');
    }
    return found;
  }

  function pointer(type: string, init: Record<string, number> = {}): PointerEvent {
    const event = new MouseEvent(type, { bubbles: true, ...init }) as unknown as PointerEvent;
    return event;
  }

  function pointOf(id: string): { clientX: number; clientY: number } {
    const found = api().screenPointOf(id);
    if (found === null) {
      throw new Error(`no screen point for ${id}`);
    }
    return found;
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    scheduler.run();
  }

  async function setup(): Promise<void> {
    twin = fakeTwin();
    const substation = fullSubstation();
    twin.api.detail = { ...caseDetail(), substation };
    twin.api.created = sessionCreated(
      twinState({
        switches: [...allSwitchPositions(substation)].map(([id, position]) => ({ id, position })),
        nodes: substation.nodes.map((id) => ({ id, state: 'ENERGIZED' as const })),
      }),
    );
    scheduler = new ManualScheduler();
    renderers = [];
    const environment: SceneEnvironment = {
      available: () => webgl,
      createRenderer: (target) => {
        if (failing) {
          throw new Error('no context');
        }
        const renderer = new FakeRenderer(target);
        renderers.push(renderer);
        return renderer;
      },
      createLabels: () => new StubLabels(),
      scheduler,
    };
    TestBed.configureTestingModule({
      providers: [...twin.providers, { provide: SCENE_ENVIRONMENT, useValue: environment }],
    });
    store = TestBed.inject(TwinStore);
    await store.start();
    fixture = TestBed.createComponent(SceneView);
    await settle();
  }

  beforeEach(() => {
    Object.assign(HTMLCanvasElement.prototype, {
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
      hasPointerCapture: () => false,
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      },
    );
    webgl = true;
    failing = false;
    delete (window as { __gridtwin?: GridtwinGlobal }).__gridtwin;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws the scene and exposes it for the tests', async () => {
    await setup();
    expect(renderers).toHaveLength(1);
    expect(renderers[0]?.renders).toBeGreaterThan(0);
    const description = api().describe();
    expect(description.webgl).toBe(true);
    expect(description.items.length).toBeGreaterThan(20);
    expect(description.items.find((item) => item.id === 'CPL.QA1')?.position).toBe('CLOSED');
    expect(element().querySelector('[data-testid="scene-unavailable"]')).toBeNull();
    expect(element().textContent).toContain('Click a switch');
  });

  it('shows a message and still describes itself when WebGL is missing', async () => {
    webgl = false;
    await setup();
    expect(renderers).toHaveLength(0);
    expect(element().querySelector('[data-testid="scene-unavailable"]')?.textContent).toContain(
      'needs WebGL',
    );
    expect(api().describe()).toEqual({ webgl: false, animating: false, items: [] });
    expect(api().screenPointOf('CPL.QA1')).toBeNull();
    expect(api().focusOn('CPL.QA1')).toBe(false);
    expect(api().frameStats()).toBeNull();
    await expect(api().measureFrames()).rejects.toThrow('not available');
  });

  it('falls back to the message when the context cannot be created', async () => {
    failing = true;
    await setup();
    expect(element().querySelector('[data-testid="scene-unavailable"]')).not.toBeNull();
  });

  it('follows the store: an opened switch is shown open', async () => {
    await setup();
    const opened = twinState({
      switches: [...allSwitchPositions(fullSubstation())].map(([id, position]) => ({
        id,
        position: id === 'L3-4.QA1' ? ('OPEN' as const) : position,
      })),
      nodes: fullSubstation().nodes.map((id) => ({ id, state: 'ENERGIZED' as const })),
    });
    vi.spyOn(twin.api, 'operateSwitch').mockReturnValue(of({ version: 2, state: opened }));
    store.requestSwitch('L3-4.QA1', 'OPEN');
    await settle();
    expect(
      api()
        .describe()
        .items.find((item) => item.id === 'L3-4.QA1')?.position,
    ).toBe('CLOSED');
    await store.confirmPending();
    await settle();
    expect(
      api()
        .describe()
        .items.find((item) => item.id === 'L3-4.QA1')?.position,
    ).toBe('OPEN');
  });

  it('turns a click on equipment into a pending request that waits for confirmation', async () => {
    await setup();
    const point = pointOf('L3-4.QA1');
    const target = canvas();
    target.dispatchEvent(
      pointer('pointerdown', { button: 0, clientX: point.clientX, clientY: point.clientY }),
    );
    target.dispatchEvent(
      pointer('pointerup', { button: 0, clientX: point.clientX, clientY: point.clientY }),
    );
    await settle();
    expect(store.pending()).toEqual({ switchId: 'L3-4.QA1', position: 'OPEN' });
    expect(twin.api.calls.some((call) => call.startsWith('operateSwitch'))).toBe(false);
    expect(store.selection()).not.toBeNull();
  });

  it('does not operate on a click that was a drag', async () => {
    await setup();
    const point = pointOf('L3-4.QA1');
    const target = canvas();
    target.dispatchEvent(
      pointer('pointerdown', { button: 0, clientX: point.clientX, clientY: point.clientY }),
    );
    target.dispatchEvent(
      pointer('pointermove', {
        buttons: 0,
        clientX: point.clientX + 40,
        clientY: point.clientY,
      }),
    );
    target.dispatchEvent(
      pointer('pointerup', {
        button: 0,
        clientX: point.clientX + 40,
        clientY: point.clientY,
      }),
    );
    await settle();
    expect(store.pending()).toBeNull();
  });

  it('ignores clicks on empty space and other buttons', async () => {
    await setup();
    const target = canvas();
    target.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 12, clientY: 22 }));
    target.dispatchEvent(pointer('pointerup', { button: 0, clientX: 12, clientY: 22 }));
    target.dispatchEvent(pointer('pointerdown', { button: 2, clientX: 400, clientY: 200 }));
    target.dispatchEvent(pointer('pointerup', { button: 2, clientX: 400, clientY: 200 }));
    expect(store.pending()).toBeNull();
    expect(store.selection()).toBeNull();
  });

  it('hovers equipment in the store and clears it when the pointer leaves', async () => {
    await setup();
    const point = pointOf('L3-4.QA1');
    const target = canvas();
    target.dispatchEvent(
      pointer('pointermove', { buttons: 0, clientX: point.clientX, clientY: point.clientY }),
    );
    expect(store.hover()).not.toBeNull();
    await settle();
    expect(element().querySelector('[data-testid="scene-readout"]')?.textContent).toContain('L3-4');
    target.dispatchEvent(pointer('pointerleave'));
    expect(store.hover()).toBeNull();
  });

  it('moves the camera with the view buttons and focuses the selection', async () => {
    await setup();
    const focus = element().querySelector<HTMLButtonElement>('[data-action="focus-selection"]');
    expect(focus?.disabled).toBe(true);
    store.select({ kind: 'switch', id: 'L3-4.QA1' });
    await settle();
    expect(focus?.disabled).toBe(false);
    const before = renderers[0]?.renders ?? 0;
    focus?.click();
    element().querySelector<HTMLButtonElement>('[data-action="top-view"]')?.click();
    element().querySelector<HTMLButtonElement>('[data-action="reset-view"]')?.click();
    scheduler.run();
    expect(renderers[0]?.renders).toBeGreaterThan(before);
  });

  it('releases the renderer and the diagnostics when destroyed', async () => {
    await setup();
    fixture.destroy();
    expect(renderers[0]?.disposed).toBe(true);
    expect((window as { __gridtwin?: GridtwinGlobal }).__gridtwin?.['scene']).toBeUndefined();
    expect(TestBed.inject(Diagnostics)).toBeTruthy();
  });
});
