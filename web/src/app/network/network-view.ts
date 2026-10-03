import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { TwinStore } from '../core/twin-store';
import { branchSelection, busSelection } from '../model/selection';
import { buildLayout } from './network-layout';
import { buildNetworkModel } from './network-model';
import { ParticleLayer } from './particle-layer';
import type { ParticleFlow } from './particle-layer';

@Component({
  selector: 'gt-network-view',
  imports: [ParticleLayer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './network-view.html',
  styleUrl: './network-view.css',
})
export class NetworkView {
  protected readonly store = inject(TwinStore);

  protected readonly layout = computed(() => {
    const detail = this.store.caseDetail();
    return detail === null ? null : buildLayout(detail);
  });

  protected readonly viewBoxText = computed(() => {
    const box = this.layout()?.viewBox;
    return box === undefined ? '0 0 100 100' : `${box.x} ${box.y} ${box.width} ${box.height}`;
  });

  protected readonly model = computed(() => {
    const detail = this.store.caseDetail();
    const layout = this.layout();
    const state = this.store.state();
    if (detail === null || layout === null || state === null) {
      return null;
    }
    return buildNetworkModel(detail, layout, state, this.store.selection(), this.store.hover());
  });

  protected readonly flows = computed<ParticleFlow[]>(() =>
    (this.model()?.branches ?? []).flatMap((branch) =>
      branch.flow === null
        ? []
        : [
            {
              id: branch.id,
              start: branch.geometry.start,
              end: branch.geometry.end,
              direction: branch.flow.direction,
              speed: branch.flow.speed,
              spacing: branch.flow.spacing,
              colour: branch.colour,
            },
          ],
    ),
  );

  protected readonly viewBox = computed(
    () => this.layout()?.viewBox ?? { x: 0, y: 0, width: 100, height: 100 },
  );

  protected readonly aspectRatio = computed(() => {
    const box = this.viewBox();
    return `${box.width} / ${box.height}`;
  });

  protected selectBus(number: number): void {
    this.store.select(busSelection(number));
  }

  protected selectBranch(id: string): void {
    this.store.select(branchSelection(id));
  }

  protected hoverBus(number: number | null): void {
    this.store.setHover(number === null ? null : busSelection(number));
  }

  protected hoverBranch(id: string | null): void {
    this.store.setHover(id === null ? null : branchSelection(id));
  }
}
