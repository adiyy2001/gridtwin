import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';

import { Inspector } from './inspector';
import { ApiError } from '../core/api-error';
import { TwinStore } from '../core/twin-store';
import { branchState, twinState } from '../testing/fixtures';
import { fakeTwin } from '../testing/providers';
import type { FakeTwin } from '../testing/providers';

describe('Inspector', () => {
  let twin: FakeTwin;
  let fixture: ComponentFixture<Inspector>;
  let store: InstanceType<typeof TwinStore>;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function click(selector: string): void {
    element().querySelector<HTMLElement>(selector)?.click();
  }

  beforeEach(async () => {
    twin = fakeTwin();
    TestBed.configureTestingModule({ providers: twin.providers });
    store = TestBed.inject(TwinStore);
    await store.start();
    fixture = TestBed.createComponent(Inspector);
    await fixture.whenStable();
  });

  it('lists the buses first', () => {
    expect(element().querySelectorAll('[data-entry^="bus-"]')).toHaveLength(3);
    expect(element().textContent).toContain('Select a bus, a branch or a switch');
  });

  it('shows the details of a selected bus', async () => {
    click('[data-entry="bus-2"]');
    await fixture.whenStable();
    const details = element().querySelector('[data-details="bus"]');
    expect(details?.textContent).toContain('1.010 pu');
    expect(details?.textContent).toContain('Energized');
    expect(element().querySelector('[data-entry="bus-2"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('switches to the branch list and shows branch details', async () => {
    const buttons = element().querySelectorAll<HTMLButtonElement>('.kind-switch button');
    buttons[1]?.click();
    await fixture.whenStable();
    expect(element().querySelectorAll('[data-entry^="branch-"]')).toHaveLength(2);
    click('[data-entry="branch-L1-2"]');
    await fixture.whenStable();
    const details = element().querySelector('[data-details="branch"]');
    expect(details?.textContent).toContain('60.0 MW at bus 1');
    expect(details?.textContent).toContain('Line');
  });

  it('shows the selection made elsewhere', async () => {
    store.selectBranch('L2-4');
    await fixture.whenStable();
    expect(element().querySelector('[data-details="branch"]')?.textContent).toContain('2 to 4');
  });

  it('lists the switches of the bay of the selected branch', async () => {
    store.selectBranch('L2-4');
    await fixture.whenStable();
    const bay = element().querySelector('[data-bay="L2-4"]');
    expect(bay?.querySelectorAll('[data-switch]')).toHaveLength(3);
    expect(bay?.textContent).toContain('Breaker L2-4.QA1');
  });

  it('lists the coupler for a busbar bus', async () => {
    store.selectBus(4);
    await fixture.whenStable();
    expect(element().querySelector('[data-bay="CPL"]')).not.toBeNull();
    expect(element().querySelector('[data-details="bus"]')?.textContent).toContain('Busbar 1');
  });

  it('asks the store for a confirmation instead of switching at once', async () => {
    store.selectBranch('L2-4');
    await fixture.whenStable();
    click('[data-switch="L2-4.QA1"]');
    expect(store.pending()).toEqual({ switchId: 'L2-4.QA1', position: 'OPEN' });
    expect(twin.api.calls.some((call) => call.startsWith('operateSwitch'))).toBe(false);
  });

  it('disables switching while a preview is shown', async () => {
    store.selectBranch('L2-4');
    await store.previewContingency('branch:L1-2');
    await fixture.whenStable();
    expect(element().querySelector<HTMLButtonElement>('[data-switch="L2-4.QA1"]')?.disabled).toBe(
      true,
    );
    expect(element().textContent).toContain('live state only');
  });

  it('marks an overloaded branch in the list', async () => {
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
    const buttons = element().querySelectorAll<HTMLButtonElement>('.kind-switch button');
    buttons[1]?.click();
    await fixture.whenStable();
    expect(element().querySelector('[data-entry="branch-L1-2"] .alarm')?.textContent).toContain(
      'overloaded',
    );
  });

  it('shows the details of a selected switch with its bay', async () => {
    store.selectSwitch('L2-4.QA1');
    await fixture.whenStable();
    const details = element().querySelector('[data-details="switch"]');
    expect(details?.textContent).toContain('Closed');
    expect(details?.textContent).toContain('Line to bus 2');
    expect(element().querySelector('h3')?.textContent).toContain('Breaker L2-4.QA1');
    expect(element().querySelector('[data-bay="L2-4"]')).not.toBeNull();
  });

  it('shows the reason of a refused operation until it is dismissed', async () => {
    twin.api.failure = new ApiError(409, 'interlock', 'Open the breaker first.', 'L2-4.QB1');
    store.requestSwitch('L2-4.QB1', 'CLOSED');
    await store.confirmPending();
    await fixture.whenStable();
    const refusal = element().querySelector('[data-testid="refusal"]');
    expect(refusal?.textContent).toContain('closing L2-4.QB1');
    expect(refusal?.textContent).toContain('Open the breaker first.');
    refusal?.querySelector('button')?.click();
    await fixture.whenStable();
    expect(element().querySelector('[data-testid="refusal"]')).toBeNull();
  });
});
