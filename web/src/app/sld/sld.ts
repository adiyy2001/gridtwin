import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';

import { TwinStore } from '../core/twin-store';
import { anchorFor, isNavKey, nextItem } from './keyboard';
import type { NavKey, NavPoint } from './keyboard';
import { buildSldLayout } from './layout';
import { buildSldModel, entryFor } from './state-model';

@Component({
  selector: 'gt-sld',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sld.html',
  styleUrl: './sld.css',
})
export class SingleLineDiagram {
  protected readonly store = inject(TwinStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly activeKey = signal<string | null>(null);
  private anchor: NavPoint | null = null;

  protected readonly substation = computed(() => this.store.caseDetail()?.substation ?? null);

  protected readonly layout = computed(() => {
    const substation = this.substation();
    return substation === null ? null : buildSldLayout(substation);
  });

  protected readonly operable = computed(
    () => this.store.isLive() && !this.store.busy() && this.store.pending() === null,
  );

  protected readonly model = computed(() => {
    const layout = this.layout();
    const substation = this.substation();
    const detail = this.store.caseDetail();
    const state = this.store.state();
    if (layout === null || substation === null || detail === null || state === null) {
      return null;
    }
    return buildSldModel({
      layout,
      substation,
      nodeStates: this.store.nodeConditions(),
      positions: this.store.shownSwitchPositions(),
      branches: this.store.branchesById(),
      transformers: new Set(detail.branches.filter((b) => b.transformer).map((b) => b.id)),
      buses: this.store.busesByNumber(),
      selection: this.store.selection(),
      hover: this.store.hover(),
      operable: this.operable(),
    });
  });

  protected readonly tabKey = computed(() => {
    const items = this.model()?.items ?? [];
    const active = this.activeKey();
    if (active !== null && items.some((item) => item.id === active)) {
      return active;
    }
    return items[0]?.id ?? null;
  });

  protected tabIndexOf(key: string): number {
    return this.tabKey() === key ? 0 : -1;
  }

  protected activate(key: string): void {
    const model = this.model();
    const entry = model === null ? null : entryFor(key, model);
    if (entry === null) {
      return;
    }
    this.activeKey.set(key);
    this.store.select(entry.selection);
    if (entry.switchId !== null && entry.targetPosition !== null && this.operable()) {
      this.store.requestSwitch(entry.switchId, entry.targetPosition);
    }
  }

  protected onKeydown(event: KeyboardEvent, key: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.activate(key);
      return;
    }
    if (event.key === 'Escape') {
      this.store.select(null);
      return;
    }
    if (isNavKey(event.key)) {
      event.preventDefault();
      this.move(key, event.key);
    }
  }

  protected onFocus(key: string): void {
    const model = this.model();
    const entry = model === null ? null : entryFor(key, model);
    const item = model?.items.find((candidate) => candidate.id === key);
    if (item !== undefined) {
      this.anchor = anchorFor(item, this.anchor);
    }
    this.activeKey.set(key);
    this.store.setHover(entry?.selection ?? null);
  }

  protected onBlur(): void {
    this.store.setHover(null);
  }

  protected hover(key: string | null): void {
    const model = this.model();
    const entry = model === null || key === null ? null : entryFor(key, model);
    this.store.setHover(entry?.selection ?? null);
  }

  private move(from: string, navKey: NavKey): void {
    const model = this.model();
    const current = model?.items.find((item) => item.id === from);
    if (model === null || current === undefined) {
      return;
    }
    this.anchor = anchorFor(current, this.anchor);
    const target = nextItem(model.items, from, navKey, this.anchor);
    if (target === null || target === from) {
      return;
    }
    const entry = entryFor(target, model);
    if (entry !== null) {
      this.store.select(entry.selection);
    }
    this.activeKey.set(target);
    this.host.nativeElement.querySelector<SVGGElement>(`[data-key="${target}"]`)?.focus();
  }
}
