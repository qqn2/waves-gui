import type { Signal, VectorSegment } from '../shared/types';
import { isWavedromBusFillHex } from '../wavedromBridge/wavedromColors';
import { isVectorUnknownValue, vectorUnknownFill, vectorUnknownStroke } from './stateColors';

const WAVEDROM_BUS_STROKE = '#000000';

export function segmentBusFill(seg: VectorSegment, signal: Signal): string {
  if (isVectorUnknownValue(seg.value)) return vectorUnknownFill();
  if (seg.color && isWavedromBusFillHex(seg.color)) return seg.color;
  return signal.fillColor ?? `${signal.color}30`;
}

export function segmentBusStroke(seg: VectorSegment, signal: Signal): string {
  if (isVectorUnknownValue(seg.value)) return vectorUnknownStroke();
  if (seg.color && isWavedromBusFillHex(seg.color)) return WAVEDROM_BUS_STROKE;
  return signal.color;
}
