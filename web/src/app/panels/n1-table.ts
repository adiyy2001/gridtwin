import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { TwinStore } from '../core/twin-store';
import type { ContingencySummary } from '../model/api-types';
import { formatMw, formatPercent, formatPerUnit, formatScore, tierLabel } from '../shared/format';
import { ariaSortFor, nextSort } from '../shared/sorting';
import type { SortState } from '../shared/sorting';
import { DEFAULT_N1_SORT, N1_COLUMNS, columnDefinition, sortContingencies } from './n1-sorting';
import type { N1Column } from './n1-sorting';

@Component({
  selector: 'gt-n1-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './n1-table.html',
  styleUrl: './n1-table.css',
})
export class N1Table {
  protected readonly store = inject(TwinStore);
  protected readonly columns = N1_COLUMNS;
  protected readonly sort = signal<SortState<N1Column>>(DEFAULT_N1_SORT);

  protected readonly format = {
    percent: formatPercent,
    pu: formatPerUnit,
    mw: formatMw,
    score: formatScore,
    tier: tierLabel,
  };

  protected readonly rows = computed(() => {
    const report = this.store.report();
    return report === null ? [] : sortContingencies(report.contingencies, this.sort());
  });

  protected readonly previewedId = computed(() =>
    this.store.viewMode() === 'preview' ? (this.store.preview()?.contingency.id ?? null) : null,
  );

  protected ariaSort(column: N1Column): 'ascending' | 'descending' | 'none' {
    return ariaSortFor(this.sort(), column);
  }

  protected sortBy(column: N1Column): void {
    this.sort.update((current) =>
      nextSort(current, column, columnDefinition(column).firstDirection),
    );
  }

  protected sortIndicator(column: N1Column): string {
    const state = this.ariaSort(column);
    if (state === 'none') {
      return '';
    }
    return state === 'ascending' ? '▲' : '▼';
  }

  protected run(): void {
    void this.store.runContingencies();
  }

  protected preview(row: ContingencySummary): void {
    void this.store.previewContingency(row.id);
  }

  protected rowLabel(row: ContingencySummary): string {
    return `${row.outage.kind === 'BRANCH' ? 'Branch' : 'Generator'} ${row.outage.equipmentId}`;
  }
}
