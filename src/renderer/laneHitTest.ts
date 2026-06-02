import type { Signal } from '../shared/types';
import {
  laneLogicalWidth,
  stepFromLogicalX,
  stepLogicalX,
  stepLogicalXEnd,
} from './laneTiming';

/** Step index under `logicalX` for a lane with period/phase, or null if outside the lane. */
export function stepAtLogicalXForSignal(
  logicalX: number,
  signal: Signal,
  totalSteps: number,
): number | null {
  if (totalSteps <= 0) return null;
  if (logicalX < stepLogicalX(signal, 0)) return null;
  if (logicalX >= laneLogicalWidth(signal, totalSteps)) return null;

  const step = stepFromLogicalX(logicalX, signal);
  if (step < 0 || step >= totalSteps) return null;

  const x0 = stepLogicalX(signal, step);
  const x1 = stepLogicalXEnd(signal, step);
  if (logicalX < x0 || logicalX >= x1) return null;

  return step;
}
