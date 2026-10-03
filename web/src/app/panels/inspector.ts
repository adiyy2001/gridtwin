import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { TwinStore } from '../core/twin-store';
import { branchSelection, busSelection } from '../model/selection';
import {
  branchStateLabel,
  busStateLabel,
  formatDegrees,
  formatKa,
  formatKv,
  formatMvar,
  formatMw,
  formatPercent,
  formatPerUnit,
  positionLabel,
} from '../shared/format';
import {
  busPlacement,
  switchGroupsForBranch,
  switchGroupsForBus,
  switchGroupsForSwitch,
  switchKindLabel,
  switchSides,
} from './inspector-model';
import type { SwitchRow } from './inspector-model';

type ListKind = 'bus' | 'branch';

@Component({
  selector: 'gt-inspector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inspector.html',
  styleUrl: './inspector.css',
})
export class Inspector {
  protected readonly store = inject(TwinStore);
  protected readonly listKind = signal<ListKind>('bus');

  protected readonly format = {
    percent: formatPercent,
    mw: formatMw,
    mvar: formatMvar,
    kv: formatKv,
    ka: formatKa,
    pu: formatPerUnit,
    degrees: formatDegrees,
    position: positionLabel,
    busState: busStateLabel,
    branchState: branchStateLabel,
  };

  protected readonly buses = computed(() => this.store.state()?.buses ?? []);
  protected readonly branches = computed(() => this.store.state()?.branches ?? []);

  protected readonly caseBranch = computed(() => {
    const branch = this.store.selectedBranch();
    return branch === null
      ? null
      : (this.store.caseDetail()?.branches.find((entry) => entry.id === branch.id) ?? null);
  });

  protected readonly busPlacement = computed(() => {
    const bus = this.store.selectedBus();
    return bus === null ? null : busPlacement(this.store.caseDetail()?.substation, bus);
  });

  protected readonly switchGroups = computed(() => {
    const substation = this.store.caseDetail()?.substation;
    const positions = this.store.switchPositions();
    const selectedSwitch = this.store.selectedSwitch();
    if (selectedSwitch !== null) {
      return switchGroupsForSwitch(substation, selectedSwitch, positions);
    }
    const branch = this.store.selectedBranch();
    if (branch !== null) {
      return switchGroupsForBranch(substation, branch, positions);
    }
    const bus = this.store.selectedBus();
    return bus === null ? [] : switchGroupsForBus(substation, bus, positions);
  });

  protected readonly switchDetails = computed(() => {
    const description = this.store.selectedSwitch();
    if (description === null) {
      return null;
    }
    const position = this.store.shownSwitchPositions().get(description.id);
    return {
      id: description.id,
      kindLabel: switchKindLabel(description.kind),
      bayName:
        this.store.caseDetail()?.substation?.bays.find((bay) => bay.id === description.bay)?.name ??
        description.bay,
      position: position ?? description.initialPosition,
      sides: switchSides(description, this.store.nodeConditions()),
    };
  });

  protected readonly switchesEditable = computed(() => this.store.isLive() && !this.store.busy());

  protected showKind(kind: ListKind): void {
    this.listKind.set(kind);
  }

  protected chooseBus(number: number): void {
    this.store.select(busSelection(number));
  }

  protected chooseBranch(id: string): void {
    this.store.select(branchSelection(id));
  }

  protected isBusSelected(number: number): boolean {
    const selection = this.store.selection();
    return selection?.kind === 'bus' && selection.id === String(number);
  }

  protected isBranchSelected(id: string): boolean {
    const selection = this.store.selection();
    return selection?.kind === 'branch' && selection.id === id;
  }

  protected dismissRefusal(): void {
    this.store.dismissRefusal();
  }

  protected operate(row: SwitchRow): void {
    this.store.requestSwitch(row.id, row.targetPosition);
  }
}
