import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TwinStore } from './core/twin-store';
import { NetworkView } from './network/network-view';
import { CascadePanel } from './panels/cascade-panel';
import { ConfirmationHost } from './panels/confirmation-host';
import { Inspector } from './panels/inspector';
import { LoadSlider } from './panels/load-slider';
import { N1Table } from './panels/n1-table';
import { StatusBar } from './panels/status-bar';
import { SummaryBar } from './panels/summary-bar';
import { SingleLineDiagram } from './sld/sld';

@Component({
  selector: 'gt-root',
  imports: [
    CascadePanel,
    ConfirmationHost,
    Inspector,
    LoadSlider,
    N1Table,
    NetworkView,
    SingleLineDiagram,
    StatusBar,
    SummaryBar,
  ],
  providers: [Dialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly store = inject(TwinStore);

  constructor() {
    void this.store.start();
  }

  protected retry(): void {
    void this.store.start();
  }
}
