import type { BitState } from '../shared/types';
import { VECTOR_UNKNOWN_LABEL } from '../shared/vectorSegments';

export const X_FILL = 'rgba(255, 107, 107, 0.25)';
export const X_STROKE = '#ff6b6b';
export const Z_STROKE = '#aaaaaa';

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
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
  if (bitState === 'z') return Z_STROKE;
  return signalColor;
}

export function zStrokeColor(signalColor: string): string {
  return `${signalColor}80`;
}
