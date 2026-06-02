import { CELL_WIDTH } from '../shared/constants';
import type { Signal } from '../shared/types';

/** WaveDrom period: cycles per displayed column (integer >= 1). */
export function lanePeriod(signal: Signal): number {
  const p = signal.period;
  if (p === undefined || p < 1) return 1;
  return Math.floor(p);
}

/** WaveDrom phase: horizontal shift in step units (may be fractional). */
export function lanePhase(signal: Signal): number {
  return signal.phase ?? 0;
}

/** Logical width of one step column for this lane. */
export function stepLogicalWidth(signal: Signal): number {
  return CELL_WIDTH * lanePeriod(signal);
}

/** Logical X at the left edge of `step` for this lane (before hscale/zoom). */
export function stepLogicalX(signal: Signal, step: number): number {
  return (step + lanePhase(signal)) * stepLogicalWidth(signal);
}

/** Logical X at the right edge of `step`. */
export function stepLogicalXEnd(signal: Signal, step: number): number {
  return stepLogicalX(signal, step + 1);
}

/** Center of step column in logical coordinates. */
export function stepLogicalCenter(signal: Signal, step: number): number {
  return (stepLogicalX(signal, step) + stepLogicalXEnd(signal, step)) / 2;
}

/** Total logical width spanned by `totalSteps` columns for this lane. */
export function laneLogicalWidth(signal: Signal, totalSteps: number): number {
  return stepLogicalXEnd(signal, totalSteps - 1);
}

/** Map canvas X to step index for a lane (uniform grid fallback when signal omitted). */
export function stepFromLogicalX(
  logicalX: number,
  signal: Signal | null,
): number {
  if (!signal) {
    return Math.floor(logicalX / CELL_WIDTH);
  }
  const period = lanePeriod(signal);
  const phase = lanePhase(signal);
  const w = CELL_WIDTH * period;
  return Math.floor(logicalX / w - phase);
}
