import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';

import { TwinStore } from '../core/twin-store';
import type { NodeCondition } from '../model/api-types';
import { caseDetail, sessionCreated, twinState } from '../testing/fixtures';
import { fakeTwin } from '../testing/providers';
import type { FakeTwin } from '../testing/providers';
import { allSwitchPositions, fullSubstation } from '../testing/substation-fixture';
import { SingleLineDiagram } from './sld';

describe('SingleLineDiagram', () => {
  let twin: FakeTwin;
  let fixture: ComponentFixture<SingleLineDiagram>;
  let store: InstanceType<typeof TwinStore>;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function item(selector: string): SVGGElement {
    const found = element().querySelector<SVGGElement>(selector);
    if (found === null) {
      throw new Error(`nothing matches ${selector}`);
    }
    return found;
  }

  function key(target: Element, name: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
  }

  async function setup(nodes: Record<string, NodeCondition> = {}): Promise<void> {
    twin = fakeTwin();
    const substation = fullSubstation();
    twin.api.detail = { ...caseDetail(), substation };
    twin.api.created = sessionCreated(
      twinState({
        switches: [...allSwitchPositions(substation)].map(([id, position]) => ({ id, position })),
        nodes: substation.nodes.map((id) => ({ id, state: nodes[id] ?? 'ENERGIZED' })),
      }),
    );
    TestBed.configureTestingModule({ providers: twin.providers });
    store = TestBed.inject(TwinStore);
    await store.start();
    fixture = TestBed.createComponent(SingleLineDiagram);
    await settle();
  }

  it('shows a message until the case is loaded', async () => {
    twin = fakeTwin();
    TestBed.configureTestingModule({ providers: twin.providers });
    fixture = TestBed.createComponent(SingleLineDiagram);
    await settle();
    expect(element().textContent).toContain('Loading the diagram');
  });

  it('says so when the network has no substation', async () => {
    twin = fakeTwin();
    twin.api.detail = { ...caseDetail(), substation: null };
    TestBed.configureTestingModule({ providers: twin.providers });
    await TestBed.inject(TwinStore).start();
    fixture = TestBed.createComponent(SingleLineDiagram);
    await settle();
    expect(element().textContent).toContain('no substation drawing');
  });

  describe('with the full substation', () => {
    beforeEach(() => setup());

    it('draws every switch, busbar and terminal as a button', () => {
      expect(element().querySelectorAll('[data-sld-switch]')).toHaveLength(
        fullSubstation().switches.length,
      );
      expect(element().querySelectorAll('[data-sld-busbar]')).toHaveLength(2);
      expect(element().querySelectorAll('[data-sld-terminal]')).toHaveLength(5);
      element()
        .querySelectorAll('[role="button"]')
        .forEach((button) => {
          expect(button.getAttribute('aria-label')).toBeTruthy();
        });
    });

    it('shows the position and state of each switch as data and text', () => {
      const breaker = item('[data-sld-switch="L2-4.QA1"]');
      expect(breaker.getAttribute('data-position')).toBe('CLOSED');
      expect(breaker.getAttribute('data-condition')).toBe('ENERGIZED');
      expect(item('[data-sld-switch="L2-4.QB1"]').getAttribute('data-position')).toBe('OPEN');
    });

    it('keeps exactly one equipment button in the tab order', () => {
      const tabbable = element().querySelectorAll('[role="button"][tabindex="0"]');
      expect(tabbable).toHaveLength(1);
      expect(tabbable[0]?.getAttribute('data-sld-busbar')).toBe('BB1');
    });

    it('asks for a confirmation when a switch is clicked and selects it', () => {
      item('[data-sld-switch="L2-4.QA1"]').dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      expect(store.pending()).toEqual({ switchId: 'L2-4.QA1', position: 'OPEN' });
      expect(store.selection()).toEqual({ kind: 'switch', id: 'L2-4.QA1' });
    });

    it('asks to close an open switch', () => {
      item('[data-sld-switch="L2-4.QB1"]').dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      expect(store.pending()).toEqual({ switchId: 'L2-4.QB1', position: 'CLOSED' });
    });

    it('operates with Enter and with Space', () => {
      key(item('[data-sld-switch="L3-4.QA1"]'), 'Enter');
      expect(store.pending()?.switchId).toBe('L3-4.QA1');
      store.cancelPending();
      key(item('[data-sld-switch="L4-5.QA1"]'), ' ');
      expect(store.pending()?.switchId).toBe('L4-5.QA1');
    });

    it('only selects a busbar and a terminal', () => {
      item('[data-sld-busbar="BB2"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(store.selection()).toEqual({ kind: 'bus', id: '40' });
      item('[data-sld-terminal="L2-4"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(store.selection()).toEqual({ kind: 'branch', id: 'L2-4' });
      expect(store.pending()).toBeNull();
    });

    it('does not ask for a confirmation outside the live state', async () => {
      store.setCascadeIndex(0);
      store.showLive();
      await store.previewContingency('branch:L1-2');
      await settle();
      item('[data-sld-switch="L2-4.QA1"]').dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      expect(store.pending()).toBeNull();
      expect(item('[data-sld-switch="L2-4.QA1"]').getAttribute('aria-label')).not.toContain(
        'Press Enter',
      );
    });

    it('moves focus with the arrow keys and moves the selection along', async () => {
      const first = item('[data-sld-busbar="BB1"]');
      first.focus();
      key(first, 'ArrowRight');
      await settle();
      const focused = document.activeElement;
      expect(focused?.getAttribute('data-key')).toBe('switch:L2-4.QB1');
      expect(store.selection()).toEqual({ kind: 'switch', id: 'L2-4.QB1' });
      expect(element().querySelectorAll('[role="button"][tabindex="0"]')).toHaveLength(1);
      expect(item('[data-sld-switch="L2-4.QB1"]').getAttribute('tabindex')).toBe('0');
    });

    it('walks right along a row and back', async () => {
      const start = item('[data-sld-switch="L2-4.QA1"]');
      start.focus();
      key(start, 'ArrowRight');
      await settle();
      expect(document.activeElement?.getAttribute('data-key')).toBe('switch:L3-4.QA1');
      key(item('[tabindex="0"]'), 'ArrowLeft');
      await settle();
      expect(document.activeElement?.getAttribute('data-key')).toBe('switch:L2-4.QA1');
    });

    it('jumps to the first and last equipment with Home and End', async () => {
      const start = item('[data-sld-switch="L2-4.QA1"]');
      start.focus();
      key(start, 'End');
      await settle();
      expect(document.activeElement?.getAttribute('data-key')).not.toBe('switch:L2-4.QA1');
      key(item('[tabindex="0"]'), 'Home');
      await settle();
      expect(document.activeElement?.getAttribute('data-key')).toBe('busbar:BB1');
    });

    it('stays where it is at the edge of the drawing', async () => {
      const first = item('[data-sld-busbar="BB1"]');
      first.focus();
      key(first, 'ArrowUp');
      await settle();
      expect(document.activeElement).toBe(first);
    });

    it('clears the selection with Escape', () => {
      store.selectSwitch('L2-4.QA1');
      key(item('[data-sld-switch="L2-4.QA1"]'), 'Escape');
      expect(store.selection()).toBeNull();
    });

    it('lets other keys through', () => {
      const breaker = item('[data-sld-switch="L2-4.QA1"]');
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
      breaker.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(store.pending()).toBeNull();
    });

    it('sets the hover for the other views on focus and mouse over', () => {
      const breaker = item('[data-sld-switch="L2-4.QA1"]');
      breaker.focus();
      expect(store.hover()).toEqual({ kind: 'switch', id: 'L2-4.QA1' });
      breaker.blur();
      expect(store.hover()).toBeNull();
      breaker.dispatchEvent(new MouseEvent('mouseenter'));
      expect(store.hover()?.id).toBe('L2-4.QA1');
      breaker.dispatchEvent(new MouseEvent('mouseleave'));
      expect(store.hover()).toBeNull();
    });

    it('shows a selection made in another view', async () => {
      store.selectBranch('L2-4');
      await settle();
      expect(item('[data-sld-terminal="L2-4"]').getAttribute('aria-current')).toBe('true');
      expect(item('[data-sld-switch="L2-4.QA1"]').getAttribute('aria-current')).toBeNull();
    });

    it('labels equipment with its short name and every bay with a status line', () => {
      expect(element().textContent).toContain('QA1');
      expect(element().textContent).toContain('Line to bus 2');
      expect(element().textContent).toContain('energized');
    });
  });

  describe('with de-energized and earthed sections', () => {
    beforeEach(() => setup({ 'L2-4.B': 'DEENERGIZED', 'L2-4.T': 'EARTHED' }));

    it('shows the condition in data, in the label and in words', () => {
      const earthing = item('[data-sld-switch="L2-4.QE1"]');
      expect(earthing.getAttribute('data-condition')).toBe('EARTHED');
      expect(earthing.getAttribute('aria-label')).toContain('earthed');
      expect(item('[data-sld-switch="L2-4.QB9"]').getAttribute('data-condition')).toBe(
        'DEENERGIZED',
      );
      expect(element().textContent).toContain('earthed');
    });
  });
});
