import type { BitState } from '../shared/types';
import { VECTOR_UNKNOWN_LABEL } from '../shared/vectorSegments';
import { DEFAULT_SIGNAL_COLOR } from '../shared/constants';

export const X_FILL = 'rgba(255, 107, 107, 0.25)';
export const X_STROKE = '#ff6b6b';
export const Z_STROKE = '#aaaaaa';

/** Stored signal colors that track the theme accent (not per-signal custom picks). */
const THEME_LINKED_SIGNAL_COLORS = new Set(
  [
    DEFAULT_SIGNAL_COLOR,
    '#2563eb',
    '#1d4ed8',
    '#5cadff',
    '#6eb0f5',
    '#7ec8ff',
  ].map((c) => c.toLowerCase()),
);

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

/** Theme accent for waveforms — reads live CSS (includes user accent override). */
export function themeSignalColor(): string {
  return cssVar('--signal-default', DEFAULT_SIGNAL_COLOR);
}

/**
 * Map a stored signal.color to the color used for drawing.
 * Default / theme-linked blues follow --signal-default; custom hex values are kept.
 */
export function resolveSignalColor(storedColor: string): string {
  const normalized = storedColor.trim().toLowerCase();
  if (THEME_LINKED_SIGNAL_COLORS.has(normalized)) {
    return themeSignalColor();
  }
  return storedColor;
}

/** Bus segment with WaveDrom `x` / unknown (no data[] label). */
export function isVectorUnknownValue(value: string): boolean {
  return value === VECTOR_UNKNOWN_LABEL || value.toLowerCase() === 'x';
}

export function vectorUnknownFill(): string {
  return cssVar('--bus-x-fill', 'rgba(140, 140, 140, 0.35)');
}

export function vectorUnknownStroke(): string {
  return cssVar('--bus-x-stroke', '#a0a0a0');
}

export function stateStrokeColor(bitState: BitState, signalColor: string): string {
  const color = resolveSignalColor(signalColor);
  if (bitState === 'z') return cssVar('--signal-z-stroke', Z_STROKE);
  if (bitState === 'u' || bitState === 'd') {
    return cssVar('--weak-drive-stroke', `${color}99`);
  }
  return color;
}

export function stateLineDash(bitState: BitState): number[] | null {
  if (bitState === 'u' || bitState === 'd') return [3, 3];
  return null;
}

export function zStrokeColor(signalColor: string): string {
  return `${resolveSignalColor(signalColor)}80`;
}
