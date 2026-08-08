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
import { signalTiming } from '../shared/fineTiming';

/** WaveDrom period: cycles per displayed column (integer >= 1). */
export function lanePeriod(signal: Signal): number {
  const timing = signalTiming(signal);
  if (timing?.cells.length) {
    const positive = timing.cells.find((cell) => cell.durationTicks > 0);
    return positive
      ? positive.durationTicks / timing.ticksPerStep
      : 1;
  }
  const p = signal.period;
  if (p === undefined || p < 1) return 1;
  return Math.floor(p);
}

/** WaveDrom phase: horizontal shift in step units (may be fractional). */
export function lanePhase(signal: Signal): number {
  const timing = signalTiming(signal);
  if (timing) {
    return timing.phaseTicks / timing.ticksPerStep;
  }
  return signal.phase ?? 0;
}

/** Logical width of one step column for this lane. */
export function stepLogicalWidth(signal: Signal): number {
  return CELL_WIDTH * lanePeriod(signal);
}

function timingCellWidth(signal: Signal, step: number): number | null {
  const timing = signalTiming(signal);
  const cell = timing?.cells[step];
  return timing && cell
    ? CELL_WIDTH * cell.durationTicks / timing.ticksPerStep
    : null;
}

/** Logical X at the left edge of `step` for this lane (before hscale/zoom). */
export function stepLogicalX(signal: Signal, step: number): number {
  const timing = signalTiming(signal);
  if (timing) {
    let ticks = -timing.phaseTicks;
    const fallback = timing.ticksPerStep;
    for (let index = 0; index < step; index++) {
      ticks += timing.cells[index]?.durationTicks ?? fallback;
    }
    return CELL_WIDTH * ticks / timing.ticksPerStep;
  }
  return step * stepLogicalWidth(signal) - lanePhase(signal) * CELL_WIDTH;
}

/** Logical X at the right edge of `step`. */
export function stepLogicalXEnd(signal: Signal, step: number): number {
  return stepLogicalX(signal, step)
    + (timingCellWidth(signal, step) ?? stepLogicalWidth(signal));
}

/** Center of step column in logical coordinates. */
export function stepLogicalCenter(signal: Signal, step: number): number {
  return (stepLogicalX(signal, step) + stepLogicalXEnd(signal, step)) / 2;
}

/** Total logical width spanned by `totalSteps` columns for this lane. */
export function laneLogicalWidth(signal: Signal, totalSteps: number): number {
  const cellCount = signalTiming(signal)?.cells.length ?? totalSteps;
  return stepLogicalXEnd(signal, cellCount - 1);
}

/** Map canvas X to step index for a lane (uniform grid fallback when signal omitted). */
export function stepFromLogicalX(
  logicalX: number,
  signal: Signal | null,
): number {
  if (!signal) {
    return Math.floor(logicalX / CELL_WIDTH);
  }
  const timing = signalTiming(signal);
  if (timing) {
    let cursor = -timing.phaseTicks;
    const target = logicalX * timing.ticksPerStep / CELL_WIDTH;
    for (let index = 0; index < timing.cells.length; index++) {
      cursor += timing.cells[index]!.durationTicks;
      if (target < cursor) return index;
    }
    return timing.cells.length;
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
  const cellCount = signalTiming(signal)?.cells.length ?? totalSteps;
  if (cellCount <= 0) return null;
  if (logicalX < stepLogicalX(signal, 0)) return null;
  if (logicalX >= laneLogicalWidth(signal, totalSteps)) return null;

  const step = stepFromLogicalX(logicalX, signal);
  if (step < 0 || step >= cellCount) return null;

  const x0 = stepLogicalX(signal, step);
  const x1 = stepLogicalXEnd(signal, step);
  if (logicalX < x0 || logicalX >= x1) return null;

  return step;
}
