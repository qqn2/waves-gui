import type { Signal } from '../shared/types';
import { resolveSignalColor } from './stateColors';

export function signalStroke(signal: Signal): string {
  return signal.style?.stroke ?? resolveSignalColor(signal.color);
}

export function signalFill(signal: Signal): string | undefined {
  return signal.style?.fill;
}

export function signalStrokeWidth(signal: Signal): number {
  return signal.style?.strokeWidth ?? 2;
}

export function signalStrokeDasharray(signal: Signal): number[] {
  return signal.style?.strokeDasharray ?? [];
}

