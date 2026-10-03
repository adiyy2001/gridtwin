import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { LOAD_PERCENT_MAX, LOAD_PERCENT_MIN, TwinStore } from '../core/twin-store';

@Component({
  selector: 'gt-load-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="load-title">
      <div class="panel-header">
        <h2 id="load-title">System load</h2>
        <output class="value" for="load-range" data-testid="load-value"
          >{{ store.loadPercent() }}%</output
        >
      </div>
      <label class="visually-hidden" for="load-range">Load as a percentage of the base case</label>
      <input
        id="load-range"
        type="range"
        [min]="min"
        [max]="max"
        step="5"
        [value]="store.loadPercent()"
        [attr.aria-valuetext]="store.loadPercent() + ' percent of the base load'"
        [disabled]="!store.isLive()"
        (input)="change($event)"
      />
      <div class="scale" aria-hidden="true">
        <span>{{ min }}%</span><span>100%</span><span>{{ max }}%</span>
      </div>
      <p class="muted note">
        @if (store.isLive()) {
          All loads scale together. Generators keep their setpoints and the slack absorbs the
          change.
        } @else {
          The load can be changed in the live state only.
        }
      </p>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    input[type='range'] {
      width: 100%;
      min-height: 28px;
    }
    .value {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .scale {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .note {
      margin: 0;
      font-size: 0.85rem;
    }
  `,
})
export class LoadSlider {
  protected readonly store = inject(TwinStore);
  protected readonly min = LOAD_PERCENT_MIN;
  protected readonly max = LOAD_PERCENT_MAX;

  protected change(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.store.setLoadPercent(Number(target.value));
    }
  }
}
