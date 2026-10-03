import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { TwinStore } from '../core/twin-store';

@Component({
  selector: 'gt-status-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="status" [class.error]="store.notice()?.tone === 'error'">
      <p class="message" data-testid="notice">
        @if (store.notice(); as notice) {
          <span>{{ notice.tone === 'error' ? 'Refused or failed: ' : '' }}{{ notice.text }}</span>
        } @else {
          <span class="muted">Ready.</span>
        }
      </p>
      <p class="connection" data-testid="connection" [attr.data-status]="store.connection()">
        <span aria-hidden="true" class="dot"></span>{{ connectionText() }}
        @if (store.connection() === 'lost') {
          <button type="button" (click)="restart()">Start a new session</button>
        }
      </p>
    </div>
  `,
  styles: `
    .status {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
    }
    .status.error {
      border-color: var(--danger);
      background: #fdecea;
    }
    p {
      margin: 0;
    }
    .dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: 6px;
      border-radius: 50%;
      background: var(--text-muted);
    }
    [data-status='open'] .dot {
      background: var(--ok);
    }
    [data-status='lost'] .dot {
      background: var(--danger);
    }
  `,
})
export class StatusBar {
  protected readonly store = inject(TwinStore);

  protected readonly connectionText = computed(() => {
    switch (this.store.connection()) {
      case 'idle':
        return 'Not connected';
      case 'connecting':
        return 'Connecting';
      case 'open':
        return `Live, state version ${this.store.version()}`;
      case 'reconnecting':
        return 'Connection lost, reconnecting';
      case 'lost':
        return 'Disconnected';
    }
  });

  protected restart(): void {
    void this.store.start();
  }
}
