export type LoadingBand = 'idle' | 'normal' | 'elevated' | 'high' | 'overloaded';

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

interface Stop {
  readonly at: number;
  readonly colour: Rgb;
}

export const MONITORED_VOLTAGE_MIN = 0.9;
export const MONITORED_VOLTAGE_MAX = 1.1;
export const DEENERGIZED_COLOUR = '#6b7280';
export const COLLAPSED_COLOUR = '#7c3aed';

const LOADING_STOPS: readonly Stop[] = [
  { at: 0, colour: { r: 31, g: 138, b: 76 } },
  { at: 0.6, colour: { r: 111, g: 160, b: 40 } },
  { at: 0.85, colour: { r: 214, g: 150, b: 0 } },
  { at: 1, colour: { r: 214, g: 58, b: 47 } },
];

const VOLTAGE_LOW: Rgb = { r: 190, g: 214, b: 244 };
const VOLTAGE_HIGH: Rgb = { r: 18, g: 52, b: 98 };

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return {
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  };
}

function toHex(colour: Rgb): string {
  const channel = (value: number): string => Math.round(value).toString(16).padStart(2, '0');
  return `#${channel(colour.r)}${channel(colour.g)}${channel(colour.b)}`;
}

export function loadingColour(loading: number): string {
  const value = clamp01(Number.isFinite(loading) ? loading : 0);
  const upperIndex = LOADING_STOPS.findIndex((stop) => stop.at >= value);
  const upper = LOADING_STOPS[Math.max(upperIndex, 1)];
  const lower = LOADING_STOPS[Math.max(upperIndex, 1) - 1];
  if (upper === undefined || lower === undefined) {
    return DEENERGIZED_COLOUR;
  }
  const amount = (value - lower.at) / (upper.at - lower.at);
  return toHex(mix(lower.colour, upper.colour, amount));
}

export function loadingBand(loading: number): LoadingBand {
  if (loading < 0.005) {
    return 'idle';
  }
  if (loading < 0.6) {
    return 'normal';
  }
  if (loading < 0.85) {
    return 'elevated';
  }
  if (loading <= 1) {
    return 'high';
  }
  return 'overloaded';
}

export function loadingBandLabel(band: LoadingBand): string {
  switch (band) {
    case 'idle':
      return 'no flow';
    case 'normal':
      return 'normal load';
    case 'elevated':
      return 'elevated load';
    case 'high':
      return 'near the rating';
    case 'overloaded':
      return 'overloaded';
  }
}

export function loadingStrokeWidth(band: LoadingBand): number {
  switch (band) {
    case 'idle':
    case 'normal':
      return 3;
    case 'elevated':
      return 4;
    case 'high':
      return 5;
    case 'overloaded':
      return 6;
  }
}

export function voltageShade(magnitude: number, minimum: number, maximum: number): string {
  const span = maximum - minimum;
  const amount = span > 0 ? clamp01((magnitude - minimum) / span) : 0.5;
  return toHex(mix(VOLTAGE_LOW, VOLTAGE_HIGH, amount));
}

export function voltageOutOfBand(magnitude: number): boolean {
  return magnitude < MONITORED_VOLTAGE_MIN || magnitude > MONITORED_VOLTAGE_MAX;
}
