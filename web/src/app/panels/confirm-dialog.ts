import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import type { Confirmation } from './inspector-model';

@Component({
  selector: 'gt-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <h2 id="confirm-title">{{ data.title }}</h2>
      <p id="confirm-message">{{ data.message }}</p>
      <div class="actions">
        <button type="button" data-action="cancel" (click)="close(false)">Cancel</button>
        <button type="button" class="primary" data-action="confirm" (click)="close(true)">
          {{ data.confirmLabel }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .dialog {
      background: var(--surface);
      color: var(--text);
      border-radius: var(--radius);
      padding: 20px 22px;
      width: min(440px, 92vw);
      display: grid;
      gap: 12px;
      box-shadow: 0 12px 40px rgb(0 0 0 / 35%);
    }
    p {
      margin: 0;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<Confirmation>(DIALOG_DATA);
  private readonly reference = inject<DialogRef<boolean>>(DialogRef);

  protected close(confirmed: boolean): void {
    this.reference.close(confirmed);
  }
}
