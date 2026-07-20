import type { Signal, VectorSegment } from '../shared/types';
import { isWavedromBusFillHex } from '../wavedromBridge/wavedromColors';
import { isVectorUnknownValue, vectorUnknownFill, vectorUnknownStroke, resolveSignalColor } from './stateColors';

const WAVEDROM_BUS_STROKE = '#000000';

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function segmentBusFill(seg: VectorSegment, signal: Signal): string {
  if (isVectorUnknownValue(seg.value)) return vectorUnknownFill();
  if (seg.color && isWavedromBusFillHex(seg.color)) return seg.color;
  const color = resolveSignalColor(signal.color);
  return signal.fillColor ?? `${color}30`;
}

export function segmentBusStroke(seg: VectorSegment, signal: Signal): string {
  if (isVectorUnknownValue(seg.value)) return vectorUnknownStroke();
  if (seg.color && isWavedromBusFillHex(seg.color)) {
    return cssVar('--bus-color-stroke', WAVEDROM_BUS_STROKE);
  }
  return resolveSignalColor(signal.color);
}

/** Text ink chosen for the actual bus fill rather than the surrounding UI theme. */
export function segmentBusTextColor(seg: VectorSegment): string {
  if (isVectorUnknownValue(seg.value)) {
    return cssVar('--text-secondary', '#b0b0b0');
  }
  if (seg.color && isWavedromBusFillHex(seg.color)) {
    return cssVar('--bus-label-on-color', '#172033');
  }
  return cssVar('--text-primary', '#e8e8e8');
}
