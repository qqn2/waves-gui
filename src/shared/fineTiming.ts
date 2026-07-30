import type {
  BitState,
  DiagramState,
  DigitalTimingCell,
  DigitalTiming,
  Signal,
  SignalOrGroup,
} from './types';
import { resolvePaintValue, toggleBinaryBitState } from './bitToggle';

export const MAX_TICKS_PER_STEP = 1024;
const EPSILON = 1e-9;

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return Math.abs(a);
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

export function fractionDenominator(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  for (let denominator = 1; denominator <= MAX_TICKS_PER_STEP; denominator++) {
    if (Math.abs(value * denominator - Math.round(value * denominator)) < EPSILON) {
      return denominator;
    }
  }
  return null;
}

export function timingResolution(values: number[]): number | null {
  let resolution = 1;
  for (const value of values) {
    const denominator = fractionDenominator(value);
    if (denominator === null) return null;
    const next = lcm(resolution, denominator);
    if (next > MAX_TICKS_PER_STEP) return null;
    resolution = next;
  }
  return resolution;
}

export function ticksFor(value: number, ticksPerStep: number): number {
  return Math.round(value * ticksPerStep);
}

export function timingForStates(
  states: BitState[],
  ticksPerStep: number,
  options: {
    phase?: number;
    period?: number;
    periods?: number[];
    dutyCycle?: number;
    dutyCycles?: number[];
    slewing?: number;
  },
): DigitalTiming {
  const cells = states.map((state, index) => {
    const duration = options.periods?.[index] ?? options.period ?? 1;
    const duty = options.dutyCycles?.[index] ?? options.dutyCycle;
    const durationTicks = Math.max(1, ticksFor(duration, ticksPerStep));
    return {
      state,
      durationTicks,
      ...(duty !== undefined
        ? {
            dutyTicks: Math.max(
              0,
              Math.min(durationTicks, ticksFor(duration * duty, ticksPerStep)),
            ),
          }
        : {}),
    };
  });
  return {
    ticksPerStep,
    phaseTicks: ticksFor(options.phase ?? 0, ticksPerStep),
    cells,
    ...(options.slewing !== undefined ? { slewing: options.slewing } : {}),
  };
}

export function signalTicksPerStep(signal: Signal, documentTicks = 1): number {
  return signal.digitalTiming ? Math.max(1, documentTicks) : 1;
}

function walkTimedSignals(
  signals: SignalOrGroup[],
  visit: (timing: DigitalTiming) => void,
): void {
  for (const item of signals) {
    if (item.type === 'group') {
      walkTimedSignals(item.children, visit);
    } else if (item.type === 'bit' && item.digitalTiming) {
      visit(item.digitalTiming);
    }
  }
}

function canScaleTick(value: number, from: number, to: number): boolean {
  return Number.isInteger(value) && (value * to) % from === 0;
}

/** Whether a document timebase can change without rounding any stored boundary. */
export function canRescaleDiagramTiming(
  diagram: DiagramState,
  ticksPerStep: number,
): boolean {
  if (
    !Number.isInteger(ticksPerStep)
    || ticksPerStep < 1
    || ticksPerStep > MAX_TICKS_PER_STEP
  ) return false;

  let exact = true;
  walkTimedSignals(diagram.signals, (timing) => {
    if (!exact) return;
    const from = Math.max(1, Math.floor(timing.ticksPerStep));
    exact = canScaleTick(timing.phaseTicks, from, ticksPerStep)
      && timing.cells.every((cell) => (
        canScaleTick(cell.durationTicks, from, ticksPerStep)
        && (
          cell.dutyTicks === undefined
          || canScaleTick(cell.dutyTicks, from, ticksPerStep)
        )
      ));
  });
  return exact;
}

/**
 * Change the document timebase while preserving every represented instant.
 * Callers must provide a mutable diagram (for example an Immer draft).
 */
export function rescaleDiagramTiming(
  diagram: DiagramState,
  ticksPerStep: number,
): boolean {
  if (!canRescaleDiagramTiming(diagram, ticksPerStep)) return false;
  walkTimedSignals(diagram.signals, (timing) => {
    const from = Math.max(1, Math.floor(timing.ticksPerStep));
    timing.phaseTicks = (timing.phaseTicks * ticksPerStep) / from;
    for (const cell of timing.cells) {
      cell.durationTicks = (cell.durationTicks * ticksPerStep) / from;
      if (cell.dutyTicks !== undefined) {
        cell.dutyTicks = (cell.dutyTicks * ticksPerStep) / from;
      }
    }
    timing.ticksPerStep = ticksPerStep;
  });
  diagram.config.ticksPerStep = ticksPerStep;
  return true;
}

function slicedTimingCell(
  cell: DigitalTimingCell,
  offsetTicks: number,
  durationTicks: number,
): DigitalTimingCell {
  const dutyTicks = cell.dutyTicks === undefined
    ? undefined
    : Math.max(0, Math.min(
        durationTicks,
        cell.dutyTicks - offsetTicks,
      ));
  return {
    state: cell.state,
    durationTicks,
    ...(dutyTicks !== undefined ? { dutyTicks } : {}),
  };
}

/**
 * Paint an inclusive absolute document-tick range while preserving total lane
 * duration. Boundary cells are split into Undulate wave/period entries.
 */
export function paintDigitalTimingTicks(
  timing: DigitalTiming,
  startTick: number,
  endTick: number,
  bitState: BitState,
  mode: 'set' | 'toggle',
): DigitalTimingCell[] {
  const lo = Math.min(Math.floor(startTick), Math.floor(endTick));
  const hiExclusive = Math.max(Math.floor(startTick), Math.floor(endTick)) + 1;
  const output: DigitalTimingCell[] = [];
  let cursor = -timing.phaseTicks;

  for (const cell of timing.cells) {
    const cellStart = cursor;
    const cellEnd = cursor + cell.durationTicks;
    cursor = cellEnd;
    const overlapStart = Math.max(cellStart, lo);
    const overlapEnd = Math.min(cellEnd, hiExclusive);
    if (overlapStart >= overlapEnd) {
      output.push({ ...cell });
      continue;
    }

    const targetState = mode === 'toggle'
      ? toggleBinaryBitState(cell.state)
      : resolvePaintValue(
          output.map((candidate) => candidate.state),
          output.length,
          bitState,
        );
    if (targetState === cell.state) {
      output.push({ ...cell });
      continue;
    }

    const before = overlapStart - cellStart;
    const painted = overlapEnd - overlapStart;
    const after = cellEnd - overlapEnd;
    if (before > 0) output.push(slicedTimingCell(cell, 0, before));
    output.push({ state: targetState, durationTicks: painted });
    if (after > 0) {
      output.push(slicedTimingCell(cell, before + painted, after));
    }
  }

  return output;
}
