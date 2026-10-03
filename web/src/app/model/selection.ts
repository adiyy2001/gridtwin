export type SelectionKind = 'bus' | 'branch' | 'switch';

export interface Selection {
  readonly kind: SelectionKind;
  readonly id: string;
}

export function busSelection(number: number): Selection {
  return { kind: 'bus', id: String(number) };
}

export function branchSelection(id: string): Selection {
  return { kind: 'branch', id };
}

export function switchSelection(id: string): Selection {
  return { kind: 'switch', id };
}

export function sameSelection(a: Selection | null, b: Selection | null): boolean {
  return a !== null && b !== null && a.kind === b.kind && a.id === b.id;
}
