import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';

import { CascadePanel } from './cascade-panel';
import { TwinStore } from '../core/twin-store';
import { fakeTwin } from '../testing/providers';
import type { FakeTwin } from '../testing/providers';

describe('CascadePanel', () => {
  let twin: FakeTwin;
  let fixture: ComponentFixture<CascadePanel>;
  let store: InstanceType<typeof TwinStore>;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    twin = fakeTwin();
    TestBed.configureTestingModule({ providers: twin.providers });
    store = TestBed.inject(TwinStore);
    await store.start();
    fixture = TestBed.createComponent(CascadePanel);
    await fixture.whenStable();
  });

  async function run(): Promise<void> {
    element().querySelector<HTMLButtonElement>('[data-action="run-cascade"]')?.click();
    await vi.waitFor(() => {
      expect(store.cascade()).not.toBeNull();
    });
    await fixture.whenStable();
  }

  it('says that the cascade is an educational simplification', () => {
    expect(element().textContent).toContain('Educational simplification');
  });

  it('offers every branch and generator as the first outage', () => {
    const options = Array.from(element().querySelectorAll('option')).map((option) => option.value);
    expect(options).toEqual(['branch:L1-2', 'branch:L2-4', 'generator:G1']);
  });

  it('starts from the demo branch when it exists', async () => {
    await run();
    expect(twin.api.calls).toContain('runCascade session-1 branch:L2-4');
  });

  it('starts from the chosen outage', async () => {
    const select = element().querySelector<HTMLSelectElement>('#cascade-trigger');
    if (select) {
      select.value = 'generator:G1';
      select.dispatchEvent(new Event('change'));
    }
    await fixture.whenStable();
    await run();
    expect(twin.api.calls).toContain('runCascade session-1 generator:G1');
  });

  it('shows how the cascade ended and lists the steps', async () => {
    await run();
    expect(element().querySelector('[data-testid="cascade-result"]')?.textContent).toContain(
      '2 trips',
    );
    expect(element().querySelectorAll('.steps li')).toHaveLength(3);
    expect(element().querySelector('[data-testid="cascade-step"]')?.textContent).toContain(
      'Step 0 of 2: start',
    );
  });

  it('moves the scrubber to a step and replays that state', async () => {
    await run();
    const range = element().querySelector<HTMLInputElement>('#cascade-range');
    if (range) {
      range.value = '1';
      range.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    expect(store.cascadeIndex()).toBe(1);
    expect(store.view().source).toBe('cascade');
    expect(element().querySelector('#cascade-range')?.getAttribute('aria-valuetext')).toContain(
      'trip L2-4',
    );
    expect(element().querySelector('[data-testid="cascade-step"]')?.textContent).toContain(
      'Step 1 of 2',
    );
  });

  it('jumps to a step from the list', async () => {
    await run();
    element().querySelectorAll<HTMLButtonElement>('.steps button')[2]?.click();
    await fixture.whenStable();
    expect(store.cascadeIndex()).toBe(2);
    expect(element().querySelectorAll('.steps button')[2]?.getAttribute('aria-current')).toBe(
      'step',
    );
  });

  it('plays and pauses', async () => {
    await run();
    const play = element().querySelector<HTMLButtonElement>('[data-action="play"]');
    play?.click();
    await fixture.whenStable();
    expect(store.cascadePlaying()).toBe(true);
    expect(play?.textContent).toContain('Pause');
    play?.click();
    await fixture.whenStable();
    expect(store.cascadePlaying()).toBe(false);
    expect(play?.textContent).toContain('Play');
  });

  it.each([
    ['STABLE', 'settled'],
    ['BLACKOUT', 'Nothing is energized'],
    ['NON_CONVERGED', 'no solution'],
    ['STEP_LIMIT', 'step limit'],
  ] as const)('explains the end %s', async (end, text) => {
    twin.api.cascadeResult = { ...twin.api.cascadeResult, end };
    await run();
    expect(element().querySelector('[data-testid="cascade-result"]')?.textContent).toContain(text);
  });
});
