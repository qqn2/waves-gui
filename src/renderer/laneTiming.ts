/**
 * Per-lane timing — maps WaveDrom period/phase to canvas column widths.
 *
 * period: how many logical time units one displayed column spans (integer >= 1).
 * phase:  horizontal shift in step units (can be fractional) — column i starts at (i + phase) * width.
 *
 * stepAtLogicalXForSignal() is the authoritative "which step is under this X?" for a given signal.
 */
import { CELL_WIDTH } from '../shared/constants';
import type { DiagramState, Signal, SignalOrGroup } from '../shared/types';

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
  return step * stepLogicalWidth(signal) - lanePhase(signal) * CELL_WIDTH;
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
  const w = CELL_WIDTH * period;
  return Math.floor((logicalX + lanePhase(signal) * CELL_WIDTH) / w);
}

/** Rightmost logical X required by the global grid or any period/phase-shifted lane. */
export function diagramLogicalWidth(diagram: DiagramState): number {
  let width = diagram.config.totalSteps * CELL_WIDTH;
  const walk = (items: SignalOrGroup[]) => {
    for (const item of items) {
      if (item.type === 'group') walk(item.children);
      else width = Math.max(width, laneLogicalWidth(item, diagram.config.totalSteps));
    }
  };
  walk(diagram.signals);
  return width;
}

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
