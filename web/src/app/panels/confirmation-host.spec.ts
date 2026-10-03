import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';

import { ConfirmationHost } from './confirmation-host';
import { TwinStore } from '../core/twin-store';
import { fakeTwin } from '../testing/providers';
import type { FakeTwin } from '../testing/providers';

describe('ConfirmationHost', () => {
  let twin: FakeTwin;
  let fixture: ComponentFixture<ConfirmationHost>;
  let store: InstanceType<typeof TwinStore>;

  function dialogElement(): HTMLElement | null {
    return document.querySelector('[data-action="confirm"]')?.closest('.dialog') ?? null;
  }

  function press(action: 'confirm' | 'cancel'): void {
    document.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.click();
  }

  beforeEach(async () => {
    twin = fakeTwin();
    TestBed.configureTestingModule({ providers: [...twin.providers, Dialog] });
    store = TestBed.inject(TwinStore);
    await store.start();
    fixture = TestBed.createComponent(ConfirmationHost);
    await fixture.whenStable();
  });

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((node) => {
      node.replaceChildren();
    });
  });

  it('opens nothing while no operation is pending', () => {
    expect(dialogElement()).toBeNull();
  });

  it('opens a dialog that names the operation', async () => {
    store.requestSwitch('CPL.QA1', 'OPEN');
    await fixture.whenStable();
    const dialog = dialogElement();
    expect(dialog?.textContent).toContain('Open breaker CPL.QA1?');
    expect(dialog?.textContent).toContain('Bus coupler');
  });

  it('labels the dialog for assistive technology', async () => {
    store.requestSwitch('CPL.QA1', 'OPEN');
    await fixture.whenStable();
    const container = document.querySelector('.cdk-dialog-container');
    expect(container?.getAttribute('aria-modal')).toBe('true');
    expect(container?.getAttribute('aria-labelledby')).toBe('confirm-title');
    expect(container?.getAttribute('aria-describedby')).toBe('confirm-message');
  });

  it('operates the switch after a confirmation', async () => {
    store.requestSwitch('CPL.QA1', 'OPEN');
    await fixture.whenStable();
    press('confirm');
    await vi.waitFor(() => {
      expect(twin.api.calls).toContain('operateSwitch session-1 CPL.QA1 OPEN');
    });
    expect(store.pending()).toBeNull();
    await fixture.whenStable();
    expect(dialogElement()).toBeNull();
  });

  it('drops the operation when it is cancelled', async () => {
    store.requestSwitch('CPL.QA1', 'OPEN');
    await fixture.whenStable();
    press('cancel');
    await fixture.whenStable();
    expect(store.pending()).toBeNull();
    expect(twin.api.calls.some((call) => call.startsWith('operateSwitch'))).toBe(false);
  });

  it('cancels when Escape closes the dialog', async () => {
    store.requestSwitch('CPL.QA1', 'OPEN');
    await fixture.whenStable();
    document
      .querySelector('.cdk-dialog-container')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }),
      );
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27 }),
    );
    await vi.waitFor(() => {
      expect(store.pending()).toBeNull();
    });
  });

  it('can ask again after a decision', async () => {
    store.requestSwitch('CPL.QA1', 'OPEN');
    await fixture.whenStable();
    press('cancel');
    await fixture.whenStable();
    store.requestSwitch('CPL.QB1', 'OPEN');
    await fixture.whenStable();
    expect(dialogElement()?.textContent).toContain('CPL.QB1');
  });
});
