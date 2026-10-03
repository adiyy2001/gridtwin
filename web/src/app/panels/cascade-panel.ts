import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { TwinStore } from '../core/twin-store';
import { cascadeStepLabel, stepTripLabel } from '../core/twin-view';
import { formatMw, formatPercent } from '../shared/format';

const DEFAULT_TRIGGER = 'branch:L2-4';

@Component({
  selector: 'gt-cascade-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cascade-panel.html',
  styleUrl: './cascade-panel.css',
})
export class CascadePanel {
  protected readonly store = inject(TwinStore);
  protected readonly chosenTrigger = signal<string | null>(null);

  protected readonly format = { percent: formatPercent, mw: formatMw };

  protected readonly trigger = computed(() => {
    const options = this.store.outageOptions();
    const chosen = this.chosenTrigger();
    if (chosen !== null && options.some((option) => option.id === chosen)) {
      return chosen;
    }
    const preferred = options.find((option) => option.id === DEFAULT_TRIGGER);
    return (preferred ?? options[0])?.id ?? '';
  });

  protected readonly stepText = computed(() => {
    const cascade = this.store.cascade();
    if (cascade === null) {
      return '';
    }
    const index = this.store.cascadeIndex();
    return `Step ${index} of ${cascade.steps.length - 1}: ${cascadeStepLabel(cascade, index)}`;
  });

  protected readonly rows = computed(() => {
    return (this.store.cascade()?.steps ?? []).map((step) => ({
      index: step.index,
      label: stepTripLabel(step),
      servedLoadMw: step.servedLoadMw,
      maxLoading: step.state.summary.maxLoading,
      converged: step.state.converged,
    }));
  });

  protected chooseTrigger(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      this.chosenTrigger.set(target.value);
    }
  }

  protected run(): void {
    void this.store.runCascade(this.trigger());
  }

  protected scrub(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.store.pauseCascade();
      this.store.setCascadeIndex(Number(target.value));
    }
  }

  protected goTo(index: number): void {
    this.store.pauseCascade();
    this.store.setCascadeIndex(index);
  }

  protected togglePlay(): void {
    if (this.store.cascadePlaying()) {
      this.store.pauseCascade();
    } else {
      this.store.playCascade();
    }
  }

  protected endText(end: string): string {
    switch (end) {
      case 'STABLE':
        return 'The network settled without further trips.';
      case 'BLACKOUT':
        return 'Nothing is energized any more.';
      case 'NON_CONVERGED':
        return 'The power flow has no solution after the last trip.';
      default:
        return 'The step limit was reached.';
    }
  }
}
