import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';

import { NetworkView } from './network-view';
import { TwinStore } from '../core/twin-store';
import { ApiError } from '../core/api-error';
import { branchState, twinState } from '../testing/fixtures';
import { fakeTwin } from '../testing/providers';
import type { FakeTwin } from '../testing/providers';

describe('NetworkView', () => {
  let twin: FakeTwin;
  let fixture: ComponentFixture<NetworkView>;
  let store: InstanceType<typeof TwinStore>;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    twin = fakeTwin();
    TestBed.configureTestingModule({ providers: twin.providers });
    store = TestBed.inject(TwinStore);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(NetworkView);
    await fixture.whenStable();
  }

  it('shows a placeholder before the network has loaded', async () => {
    await render();
    expect(element().textContent).toContain('Loading the network');
    expect(element().querySelectorAll('[data-bus]')).toHaveLength(0);
  });

  it('says so when the network could not be loaded', async () => {
    twin.api.failure = new ApiError(0, 'x', 'down', null);
    await store.start();
    await render();
    expect(element().textContent).toContain('could not be loaded');
  });

  it('draws every bus and branch as a labelled button', async () => {
    await store.start();
    await render();
    expect(element().querySelectorAll('[data-bus]')).toHaveLength(3);
    expect(element().querySelectorAll('[data-branch]')).toHaveLength(2);
    const bus = element().querySelector('[data-bus="2"]');
    expect(bus?.getAttribute('role')).toBe('button');
    expect(bus?.getAttribute('aria-label')).toContain('Bus 2');
  });

  it('selects a bus on click and marks it pressed', async () => {
    await store.start();
    await render();
    element()
      .querySelector<SVGGElement>('[data-bus="2"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(store.selection()).toEqual({ kind: 'bus', id: '2' });
    expect(element().querySelector('[data-bus="2"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('selects a branch with Enter and with Space', async () => {
    await store.start();
    await render();
    const branch = element().querySelector<SVGGElement>('[data-branch="L1-2"]');
    branch?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(store.selection()).toEqual({ kind: 'branch', id: 'L1-2' });
    store.select(null);
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    branch?.dispatchEvent(space);
    expect(store.selection()).toEqual({ kind: 'branch', id: 'L1-2' });
    expect(space.defaultPrevented).toBe(true);
  });

  it('reports hover and focus to the store', async () => {
    await store.start();
    await render();
    const bus = element().querySelector<SVGGElement>('[data-bus="1"]');
    bus?.dispatchEvent(new MouseEvent('mouseenter'));
    expect(store.hover()).toEqual({ kind: 'bus', id: '1' });
    bus?.dispatchEvent(new MouseEvent('mouseleave'));
    expect(store.hover()).toBeNull();
    const branch = element().querySelector<SVGGElement>('[data-branch="L2-4"]');
    branch?.dispatchEvent(new FocusEvent('focus'));
    expect(store.hover()).toEqual({ kind: 'branch', id: 'L2-4' });
    branch?.dispatchEvent(new FocusEvent('blur'));
    expect(store.hover()).toBeNull();
  });

  it('shows the overload as a label and a data attribute', async () => {
    twin.api.created = {
      ...twin.api.created,
      state: {
        version: 1,
        state: twinState({
          branches: [branchState({ id: 'L1-2', loading: 1.2, overloaded: true })],
        }),
      },
    };
    await store.start();
    await render();
    const branch = element().querySelector('[data-branch="L1-2"]');
    expect(branch?.getAttribute('data-band')).toBe('overloaded');
    expect(branch?.textContent).toContain('L1-2 120% !');
  });

  it('draws a de-energized branch as dashed', async () => {
    twin.api.created = {
      ...twin.api.created,
      state: {
        version: 1,
        state: twinState({ branches: [branchState({ id: 'L1-2', energized: false })] }),
      },
    };
    await store.start();
    await render();
    const wire = element().querySelector('[data-branch="L1-2"] .wire');
    expect(wire?.getAttribute('stroke-dasharray')).toBe('6 6');
  });

  it('offers a way back to the live state while a preview is shown', async () => {
    await store.start();
    await store.previewContingency('branch:L1-2');
    await render();
    expect(element().querySelector('.view-banner')?.textContent).toContain('not applied');
    element().querySelector<HTMLButtonElement>('.view-banner button')?.click();
    await fixture.whenStable();
    expect(element().querySelector('.view-banner')).toBeNull();
    expect(store.isLive()).toBe(true);
  });

  it('feeds the particle layer with the live branches', async () => {
    await store.start();
    await render();
    expect(element().querySelector('canvas')?.dataset['particles']).toBe('2');
  });
});
