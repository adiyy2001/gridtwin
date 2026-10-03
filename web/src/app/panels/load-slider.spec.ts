import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';

import { LoadSlider } from './load-slider';
import { LOAD_COMMIT_DELAY_MS, TwinStore } from '../core/twin-store';
import { fakeTwin } from '../testing/providers';
import type { FakeTwin } from '../testing/providers';

describe('LoadSlider', () => {
  let twin: FakeTwin;
  let fixture: ComponentFixture<LoadSlider>;
  let store: InstanceType<typeof TwinStore>;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function slider(): HTMLInputElement {
    const input = element().querySelector<HTMLInputElement>('#load-range');
    if (!input) {
      throw new Error('the slider is missing');
    }
    return input;
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    twin = fakeTwin();
    TestBed.configureTestingModule({ providers: twin.providers });
    store = TestBed.inject(TwinStore);
    await store.start();
    fixture = TestBed.createComponent(LoadSlider);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('spans 50 to 150 percent', () => {
    expect(slider().min).toBe('50');
    expect(slider().max).toBe('150');
    expect(slider().step).toBe('5');
  });

  it('shows the current load and a spoken value', () => {
    expect(element().querySelector('[data-testid="load-value"]')?.textContent).toContain('100%');
    expect(slider().getAttribute('aria-valuetext')).toBe('100 percent of the base load');
  });

  it('sends the new load once after the movement stops', async () => {
    slider().value = '130';
    slider().dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(element().querySelector('[data-testid="load-value"]')?.textContent).toContain('130%');
    await vi.advanceTimersByTimeAsync(LOAD_COMMIT_DELAY_MS);
    expect(twin.api.calls).toContain('setLoadFactor session-1 1.3');
  });

  it('is disabled while a preview is shown', async () => {
    await store.previewContingency('branch:L1-2');
    await fixture.whenStable();
    expect(slider().disabled).toBe(true);
    expect(element().textContent).toContain('live state only');
  });
});
