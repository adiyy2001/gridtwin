import type { Position, TerminalKind } from '../model/api-types';

export const SWITCH_HALF_LENGTH = 14;
export const EARTHING_LENGTH = 22;
export const TERMINAL_LENGTH = 30;

export interface SwitchSymbol {
  readonly stubs: string;
  readonly blade: string;
  readonly contact: string;
}

export interface EarthingSymbol {
  readonly blade: string;
  readonly ground: string;
}

export interface Circle {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

export interface TerminalSymbol {
  readonly outline: string;
  readonly filled: boolean;
  readonly circles: readonly Circle[];
}

const BLADE_PIVOT_Y = 8;
const CONTACT_Y = -8;
const OPEN_BLADE_END = { x: -9, y: -5 };

function bladePath(position: Position): string {
  return position === 'CLOSED'
    ? `M0 ${BLADE_PIVOT_Y} L0 ${CONTACT_Y}`
    : `M0 ${BLADE_PIVOT_Y} L${OPEN_BLADE_END.x} ${OPEN_BLADE_END.y}`;
}

export function switchSymbol(kind: 'BREAKER' | 'DISCONNECTOR', position: Position): SwitchSymbol {
  const stubs = `M0 ${-SWITCH_HALF_LENGTH} V${CONTACT_Y} M0 ${BLADE_PIVOT_Y} V${SWITCH_HALF_LENGTH}`;
  const contact =
    kind === 'BREAKER'
      ? `M-4 ${CONTACT_Y - 4} L4 ${CONTACT_Y + 4} M4 ${CONTACT_Y - 4} L-4 ${CONTACT_Y + 4}`
      : `M-5 ${CONTACT_Y} H5`;
  return { stubs, blade: bladePath(position), contact };
}

export function earthingSymbol(position: Position): EarthingSymbol {
  const blade = position === 'CLOSED' ? 'M0 0 L0 12' : 'M0 0 L-7 9';
  const ground = 'M-8 12 H8 M-5 16 H5 M-2 20 H2';
  return { blade, ground };
}

export function terminalSymbol(kind: TerminalKind, isTransformer: boolean): TerminalSymbol {
  if (isTransformer) {
    return {
      outline: '',
      filled: false,
      circles: [
        { cx: 0, cy: 10, r: 10 },
        { cx: 0, cy: 22, r: 10 },
      ],
    };
  }
  if (kind === 'LOAD') {
    return { outline: 'M-6 2 H6 L0 14 Z', filled: true, circles: [] };
  }
  if (kind === 'GENERATOR') {
    return { outline: '', filled: false, circles: [{ cx: 0, cy: 14, r: 13 }] };
  }
  return { outline: 'M-7 4 L0 16 L7 4 M0 0 V16', filled: false, circles: [] };
}
