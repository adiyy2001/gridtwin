import type { BranchState, BusState, CaseDetail, TwinState } from '../model/api-types';
import type { Selection } from '../model/selection';
import { sameSelection } from '../model/selection';
import { formatKv, formatPercent, formatPerUnit } from '../shared/format';
import {
  COLLAPSED_COLOUR,
  DEENERGIZED_COLOUR,
  loadingBand,
  loadingBandLabel,
  loadingColour,
  loadingStrokeWidth,
  voltageOutOfBand,
  voltageShade,
} from './colour-scale';
import type { LoadingBand } from './colour-scale';
import { branchGeometry, parallelIndexes } from './network-layout';
import type { BranchGeometry, NetworkLayout, Point } from './network-layout';
import { flowDirection, particleSpacing, particleSpeed } from './particles';
import type { FlowDirection } from './particles';

export interface BranchModel {
  readonly id: string;
  readonly geometry: BranchGeometry;
  readonly colour: string;
  readonly strokeWidth: number;
  readonly dash: string | null;
  readonly band: LoadingBand;
  readonly label: string;
  readonly ariaLabel: string;
  readonly selected: boolean;
  readonly hovered: boolean;
  readonly energized: boolean;
  readonly overloaded: boolean;
  readonly flow: FlowModel | null;
}

export interface FlowModel {
  readonly direction: FlowDirection;
  readonly speed: number;
  readonly spacing: number;
}

export interface BusModel {
  readonly number: number;
  readonly position: Point;
  readonly shade: string;
  readonly outline: string;
  readonly dash: string | null;
  readonly label: string;
  readonly voltageLabel: string;
  readonly ariaLabel: string;
  readonly selected: boolean;
  readonly hovered: boolean;
  readonly energized: boolean;
  readonly outOfBand: boolean;
  readonly hasGeneration: boolean;
}

export interface NetworkModel {
  readonly branches: readonly BranchModel[];
  readonly buses: readonly BusModel[];
}

export const DEENERGIZED_DASH = '6 6';
const FALLBACK_LIMITS = { min: 0.9, max: 1.1 };

function branchLabel(branch: BranchState): string {
  if (!branch.energized || !branch.inService) {
    return `${branch.id} off`;
  }
  const mark = branch.overloaded ? ' !' : '';
  return `${branch.id} ${formatPercent(branch.loading, 0)}${mark}`;
}

function branchAria(branch: BranchState, band: LoadingBand): string {
  if (!branch.inService) {
    return `Branch ${branch.id}, buses ${branch.from} to ${branch.to}, out of service`;
  }
  if (!branch.energized) {
    return `Branch ${branch.id}, buses ${branch.from} to ${branch.to}, de-energized`;
  }
  return `Branch ${branch.id}, buses ${branch.from} to ${branch.to}, loading ${formatPercent(branch.loading)}, ${loadingBandLabel(band)}`;
}

function branchModel(
  branch: BranchState,
  layout: NetworkLayout,
  parallel: ReadonlyMap<string, number>,
  selection: Selection | null,
  hover: Selection | null,
): BranchModel | null {
  const from = layout.positions.get(branch.from);
  const to = layout.positions.get(branch.to);
  if (from === undefined || to === undefined) {
    return null;
  }
  const geometry = branchGeometry(from, to, parallel.get(branch.id) ?? 0, labelSide(from, to));
  const live = branch.energized && branch.inService;
  const band = live ? loadingBand(branch.loading) : 'idle';
  const direction = live ? flowDirection(branch) : 0;
  const mw = Math.max(Math.abs(branch.activeFromMw), Math.abs(branch.activeToMw));
  return {
    id: branch.id,
    geometry,
    colour: live ? loadingColour(branch.loading) : DEENERGIZED_COLOUR,
    strokeWidth: live ? loadingStrokeWidth(band) : 3,
    dash: live ? null : DEENERGIZED_DASH,
    band,
    label: branchLabel(branch),
    ariaLabel: branchAria(branch, band),
    selected: sameSelection(selection, { kind: 'branch', id: branch.id }),
    hovered: sameSelection(hover, { kind: 'branch', id: branch.id }),
    energized: live,
    overloaded: live && branch.overloaded,
    flow:
      direction === 0
        ? null
        : { direction, speed: particleSpeed(mw), spacing: particleSpacing(branch.loading) },
  };
}

function labelSide(from: Point, to: Point): 1 | -1 {
  return to.x - from.x >= 0 ? 1 : -1;
}

function busModel(
  bus: BusState,
  detail: CaseDetail,
  layout: NetworkLayout,
  selection: Selection | null,
  hover: Selection | null,
): BusModel | null {
  const position = layout.positions.get(bus.number);
  if (position === undefined) {
    return null;
  }
  const limits = detail.buses.find((entry) => entry.number === bus.number);
  const minimum = limits?.voltageMin ?? FALLBACK_LIMITS.min;
  const maximum = limits?.voltageMax ?? FALLBACK_LIMITS.max;
  const energized = bus.state === 'ENERGIZED';
  const outOfBand = energized && voltageOutOfBand(bus.voltageMagnitude);
  const collapsed = bus.state === 'COLLAPSED';
  const selected = sameSelection(selection, { kind: 'bus', id: String(bus.number) });
  return {
    number: bus.number,
    position,
    shade: energized ? voltageShade(bus.voltageMagnitude, minimum, maximum) : DEENERGIZED_COLOUR,
    outline: collapsed ? COLLAPSED_COLOUR : outOfBand ? '#b3261e' : '#0f2a4d',
    dash: energized ? null : DEENERGIZED_DASH,
    label: `Bus ${bus.number}`,
    voltageLabel: energized
      ? `${bus.voltageMagnitude.toFixed(3)} pu${outOfBand ? ' !' : ''}`
      : 'dead',
    ariaLabel: energized
      ? `Bus ${bus.number}, ${formatPerUnit(bus.voltageMagnitude)}, ${formatKv(bus.voltageKv)}${outOfBand ? ', outside the voltage band' : ''}`
      : `Bus ${bus.number}, ${collapsed ? 'voltage collapse' : 'de-energized'}`,
    selected,
    hovered: sameSelection(hover, { kind: 'bus', id: String(bus.number) }),
    energized,
    outOfBand,
    hasGeneration: bus.activeGenerationMw > 0 || bus.type === 'PV' || bus.type === 'REFERENCE',
  };
}

export function buildNetworkModel(
  detail: CaseDetail,
  layout: NetworkLayout,
  state: TwinState,
  selection: Selection | null,
  hover: Selection | null,
): NetworkModel {
  const parallel = parallelIndexes(state.branches);
  return {
    branches: state.branches
      .map((branch) => branchModel(branch, layout, parallel, selection, hover))
      .filter((model): model is BranchModel => model !== null),
    buses: state.buses
      .map((bus) => busModel(bus, detail, layout, selection, hover))
      .filter((model): model is BusModel => model !== null),
  };
}
