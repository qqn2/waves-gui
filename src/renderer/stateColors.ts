import type { BitState } from '../shared/types';

export const X_FILL = 'rgba(255, 107, 107, 0.25)';
export const X_STROKE = '#ff6b6b';
export const Z_STROKE = '#aaaaaa';

export function stateStrokeColor(bitState: BitState, signalColor: string): string {
  if (bitState === 'z') return Z_STROKE;
  return signalColor;
}

export function zStrokeColor(signalColor: string): string {
  return `${signalColor}80`;
}
