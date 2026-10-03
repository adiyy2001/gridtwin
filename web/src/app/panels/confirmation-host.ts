import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';

import { TwinStore } from '../core/twin-store';
import { ConfirmDialog } from './confirm-dialog';
import { describeConfirmation } from './inspector-model';

@Component({
  selector: 'gt-confirmation-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class ConfirmationHost {
  private readonly store = inject(TwinStore);
  private readonly dialog = inject(Dialog);
  private open = false;

  constructor() {
    effect(() => {
      const pending = this.store.pending();
      if (pending === null || this.open) {
        return;
      }
      this.open = true;
      const confirmation = describeConfirmation(
        this.store.caseDetail()?.substation,
        pending.switchId,
        pending.position,
      );
      const reference = this.dialog.open<boolean, typeof confirmation>(ConfirmDialog, {
        data: confirmation,
        ariaModal: true,
        ariaLabelledBy: 'confirm-title',
        ariaDescribedBy: 'confirm-message',
        role: 'alertdialog',
        hasBackdrop: true,
        backdropClass: 'cdk-overlay-dark-backdrop',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        disableClose: false,
      });
      reference.closed.subscribe((confirmed) => {
        this.open = false;
        if (confirmed === true) {
          void this.store.confirmPending();
        } else {
          this.store.cancelPending();
        }
      });
    });
  }
}
