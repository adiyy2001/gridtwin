import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { TwinStore } from '../core/twin-store';
import { formatMw, formatPercent, formatPerUnit } from '../shared/format';

@Component({
  selector: 'gt-summary-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="summary" aria-label="System summary" data-testid="summary">
      @for (item of items(); track item.label) {
        <div class="item" [class.alarm]="item.alarm">
          <span class="label">{{ item.label }}</span>
          <span class="value">{{ item.value }}</span>
        </div>
      }
    </section>
  `,
  styles: `
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 22px;
    }
    .item {
      display: flex;
      flex-direction: column;
      min-width: 90px;
    }
    .label {
      font-size: 0.78rem;
      color: var(--text-muted);
    }
    .value {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .alarm .value {
      color: var(--danger);
    }
  `,
})
export class SummaryBar {
  private readonly store = inject(TwinStore);

  protected readonly items = computed(() => {
    const state = this.store.state();
    if (state === null) {
      return [];
    }
    const summary = state.summary;
    return [
      { label: 'Load', value: formatMw(summary.totalLoadMw), alarm: false },
      { label: 'Generation', value: formatMw(summary.totalGenerationMw), alarm: false },
      { label: 'Losses', value: formatMw(summary.totalLossMw), alarm: false },
      {
        label: 'Highest loading',
        value: formatPercent(summary.maxLoading),
        alarm: summary.overloadedBranches > 0,
      },
      {
        label: 'Overloaded branches',
        value: String(summary.overloadedBranches),
        alarm: summary.overloadedBranches > 0,
      },
      { label: 'Lowest voltage', value: formatPerUnit(summary.lowestVoltage), alarm: false },
      {
        label: 'Load not served',
        value: formatMw(summary.shedLoadMw),
        alarm: summary.shedLoadMw > 0,
      },
      {
        label: 'Power flow',
        value: state.converged ? 'Converged' : 'No solution',
        alarm: !state.converged,
      },
    ];
  });
}
