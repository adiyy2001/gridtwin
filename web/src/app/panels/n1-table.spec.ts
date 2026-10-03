import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';

import { N1Table } from './n1-table';
import { TwinStore } from '../core/twin-store';
import { fakeTwin } from '../testing/providers';
import type { FakeTwin } from '../testing/providers';

describe('N1Table', () => {
  let twin: FakeTwin;
  let fixture: ComponentFixture<N1Table>;
  let store: InstanceType<typeof TwinStore>;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function outageOrder(): string[] {
    return Array.from(element().querySelectorAll('tr.contingency')).map(
      (row) => row.getAttribute('data-outage') ?? '',
    );
  }

  beforeEach(async () => {
    twin = fakeTwin();
    TestBed.configureTestingModule({ providers: twin.providers });
    store = TestBed.inject(TwinStore);
    await store.start();
    fixture = TestBed.createComponent(N1Table);
    await fixture.whenStable();
  });

  async function run(): Promise<void> {
    element().querySelector<HTMLButtonElement>('[data-action="run-n1"]')?.click();
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(store.report()).not.toBeNull();
    });
    await fixture.whenStable();
  }

  it('invites the user to run the analysis first', () => {
    expect(element().textContent).toContain('Run N-1');
    expect(element().querySelector('table')).toBeNull();
  });

  it('shows the ranked outages after a run', async () => {
    await run();
    expect(outageOrder()).toEqual(['branch:L1-2', 'generator:G1', 'branch:L2-4']);
    expect(element().textContent).toContain('3 outages at 100% load');
  });

  it('labels the result tiers and missing values in text', async () => {
    await run();
    const text = element().textContent;
    expect(text).toContain('Secure');
    expect(text).toContain('No solution');
    expect(text).toContain('n/a');
  });

  it('sorts when a header button is pressed and reports it in aria-sort', async () => {
    await run();
    element().querySelector<HTMLButtonElement>('[data-sort="score"]')?.click();
    await fixture.whenStable();
    expect(outageOrder()[0]).toBe('branch:L2-4');
    const header = element().querySelector('[data-sort="score"]')?.closest('th');
    expect(header?.getAttribute('aria-sort')).toBe('descending');
    expect(
      element().querySelector('[data-sort="rank"]')?.closest('th')?.getAttribute('aria-sort'),
    ).toBe('none');
  });

  it('reverses the order when the same header is pressed again', async () => {
    await run();
    element().querySelector<HTMLButtonElement>('[data-sort="outage"]')?.click();
    await fixture.whenStable();
    expect(outageOrder()[0]).toBe('generator:G1');
    element().querySelector<HTMLButtonElement>('[data-sort="outage"]')?.click();
    await fixture.whenStable();
    expect(outageOrder()[0]).toBe('branch:L2-4');
    expect(element().querySelector('[data-sort="outage"] .indicator')?.textContent).toContain('▼');
  });

  it('previews the outage of a row on click', async () => {
    await run();
    element().querySelector<HTMLElement>('[data-outage="generator:G1"]')?.click();
    await vi.waitFor(() => {
      expect(store.viewMode()).toBe('preview');
    });
    expect(twin.api.calls).toContain('previewContingency session-1 generator:G1');
    await fixture.whenStable();
    expect(
      element().querySelector('[data-outage="branch:L1-2"]')?.getAttribute('aria-current'),
    ).toBe('true');
  });

  it('previews with Enter and with Space', async () => {
    await run();
    const row = element().querySelector<HTMLElement>('[data-outage="branch:L2-4"]');
    row?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    row?.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);
    await vi.waitFor(() => {
      expect(twin.api.calls.filter((call) => call.startsWith('previewContingency')).length).toBe(2);
    });
  });

  it('makes every row reachable with the keyboard', async () => {
    await run();
    const rows = element().querySelectorAll('tr.contingency');
    rows.forEach((row) => {
      expect(row.getAttribute('tabindex')).toBe('0');
    });
  });
});
