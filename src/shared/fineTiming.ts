import type {
  BitState,
  DiagramState,
  DigitalTimingCell,
  DigitalTiming,
  SignalTiming,
  Signal,
  SignalOrGroup,
} from './types';
import {
  isClockBitState,
  resolvePaintValue,
  toggleBinaryBitState,
} from './bitToggle';

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

export interface TimingOptions {
  phase?: number;
  period?: number;
  periods?: number[];
  dutyCycle?: number;
  dutyCycles?: number[];
  slewing?: number;
  sourceFields?: DigitalTiming['sourceFields'];
}

/** Build a native timing track without assigning signal values to its cells. */
export function timingForCellCount(
  cellCount: number,
  ticksPerStep: number,
  options: TimingOptions,
): SignalTiming {
  const cells = Array.from({ length: Math.max(0, cellCount) }, (_, index) => {
    const duration = options.periods?.[index] ?? options.period ?? 1;
    const duty = options.dutyCycles?.[index] ?? options.dutyCycle;
    const durationTicks = Math.max(1, ticksFor(duration, ticksPerStep));
    return {
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
    ...(options.sourceFields ? { sourceFields: { ...options.sourceFields } } : {}),
  };
}

export function timingForStates(
  states: BitState[],
  ticksPerStep: number,
  options: TimingOptions,
): DigitalTiming {
  const timing = timingForCellCount(states.length, ticksPerStep, options);
  return {
    ...timing,
    cells: timing.cells.map((cell, index) => ({
      ...cell,
      state: states[index] ?? '0',
    })),
  };
}

/** Sum the exact native duration of a timed digital lane. */
export function timingDurationTicks(
  timing: Pick<SignalTiming, 'cells'>,
): number {
  return timing.cells.reduce(
    (total, cell) => total + Math.max(1, Math.round(cell.durationTicks)),
    0,
  );
}

/**
 * Return a signal's unphased duration in document ticks.
 *
 * `phase` is deliberately not folded into the major grid extent: WaveDrom and
 * Undulate both treat it as a horizontal offset. The renderer accounts for the
 * shifted right edge separately through `laneLogicalWidth()`.
 */
export function signalDurationTicks(
  signal: Signal,
  documentTicksPerStep: number,
): number {
  const ticksPerStep = Math.max(1, Math.floor(documentTicksPerStep));
  const timing = signalTiming(signal);
  if (timing) {
    const timingTicks = Math.max(1, timing.ticksPerStep);
    return Math.ceil(
      timingDurationTicks(timing) * ticksPerStep / timingTicks,
    );
  }
  if (signal.type === 'bit') {
    return Math.max(0, signal.states.length) * ticksPerStep;
  }
  if (signal.type === 'vector') {
    const segmentEnd = signal.segments.reduce(
      (end, segment) => Math.max(end, segment.endStep),
      0,
    );
    return Math.max(signal.stepGaps?.length ?? 0, segmentEnd) * ticksPerStep;
  }
  if (signal.type === 'analogue') {
    return Math.max(0, signal.analogueCells?.length ?? 0) * ticksPerStep;
  }
  return 0;
}

/** Maximum unphased content duration across nested diagram signals. */
export function documentDurationTicks(
  signals: SignalOrGroup[],
  documentTicksPerStep: number,
): number {
  let maximum = 0;
  const walk = (items: SignalOrGroup[]) => {
    for (const item of items) {
      if (item.type === 'group') walk(item.children);
      else maximum = Math.max(
        maximum,
        signalDurationTicks(item, documentTicksPerStep),
      );
    }
  };
  walk(signals);
  return maximum;
}

/** Convert an exact document-tick extent into major Draw columns. */
export function durationTicksToSteps(
  durationTicks: number,
  ticksPerStep: number,
): number {
  return Math.max(
    1,
    Math.ceil(Math.max(0, durationTicks) / Math.max(1, ticksPerStep)),
  );
}

export function signalTicksPerStep(signal: Signal, documentTicks = 1): number {
  return signalTiming(signal) ? Math.max(1, documentTicks) : 1;
}

/** Native timing associated with either a bit or vector waveform lane. */
export function signalTiming(signal: Signal): SignalTiming | undefined {
  return signal.digitalTiming ?? signal.vectorTiming;
}

function walkTimedSignals(
  signals: SignalOrGroup[],
  visit: (timing: SignalTiming) => void,
): void {
  for (const item of signals) {
    if (item.type === 'group') {
      walkTimedSignals(item.children, visit);
    } else {
      const timing = signalTiming(item);
      if (timing) visit(timing);
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

function eraseStateForCell(current: BitState, previous: BitState): BitState {
  if (current === 'p' || current === 'P') return '0';
  if (current === 'n' || current === 'N') return '1';
  return previous;
}

/**
 * Erase a document-time interval without changing native time outside it.
 * Boundary cells are split when necessary; clock macros are rejected when a
 * selection would cut through only part of their represented cycle.
 */
export function eraseDigitalTimingTicksWithMapping(
  timing: DigitalTiming,
  startTick: number,
  endTick: number,
): DigitalTimingEraseResult {
  const lo = Math.min(Math.floor(startTick), Math.floor(endTick));
  const hiExclusive = Math.max(Math.floor(startTick), Math.floor(endTick));
  const output: DigitalTimingCell[] = [];
  const sourceCellRanges: TimingCellOutputRange[] = [];
  const erasedOutputCells: number[] = [];
  let cursor = -timing.phaseTicks;
  let previousState: BitState = '0';

  for (const cell of timing.cells) {
    const outputStart = output.length;
    const cellStart = cursor;
    const cellEnd = cursor + Math.max(1, Math.round(cell.durationTicks));
    cursor = cellEnd;
    const overlapStart = Math.max(cellStart, lo);
    const overlapEnd = Math.min(cellEnd, hiExclusive);
    if (overlapStart >= overlapEnd) {
      output.push({ ...cell });
      sourceCellRanges.push({ start: outputStart, end: output.length });
      previousState = cell.state;
      continue;
    }

    const isClock = isClockBitState(cell.state);
    const fullyCovered = overlapStart <= cellStart && overlapEnd >= cellEnd;
    if (isClock && !fullyCovered) {
      return { ok: false, reason: 'partial-clock-macro' };
    }

    const erasedState = eraseStateForCell(cell.state, previousState);
    const before = overlapStart - cellStart;
    const erased = overlapEnd - overlapStart;
    const after = cellEnd - overlapEnd;
    if (before > 0) output.push(slicedTimingCell(cell, 0, before));
    const erasedOutputIndex = output.length;
    output.push({ state: erasedState, durationTicks: erased });
    erasedOutputCells.push(erasedOutputIndex);
    if (after > 0) {
      output.push(slicedTimingCell(cell, before + erased, after));
    }
    sourceCellRanges.push({ start: outputStart, end: output.length });
    // When the selection reaches the cell's right boundary, the erased
    // hold-fill value is what the following cell should inherit. An
    // untouched tail keeps the original cell value for the next source cell.
    previousState = after > 0 ? cell.state : erasedState;
  }

  return { ok: true, cells: output, sourceCellRanges, erasedOutputCells };
}

function timingRangeIntersectsClockMacro(
  timing: DigitalTiming,
  startTick: number,
  endTick: number,
): boolean {
  const lo = Math.min(Math.floor(startTick), Math.floor(endTick));
  const hiExclusive = Math.max(Math.floor(startTick), Math.floor(endTick)) + 1;
  let cursor = -timing.phaseTicks;
  for (const cell of timing.cells) {
    const cellStart = cursor;
    const cellEnd = cursor + cell.durationTicks;
    cursor = cellEnd;
    if (
      isClockBitState(cell.state)
      && Math.max(cellStart, lo) < Math.min(cellEnd, hiExclusive)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Precision painting intentionally refuses clock macro cells for now.
 * A `P`/`p`/`N`/`n` symbol denotes a complete cycle, so splitting it into
 * more symbols would create extra cycles. A later clock-expansion operation
 * can turn a macro into explicit h/l cells before allowing tick painting.
 */
export function canPaintDigitalTimingTicks(
  timing: DigitalTiming,
  startTick: number,
  endTick: number,
): boolean {
  return !timingRangeIntersectsClockMacro(timing, startTick, endTick);
}

/** Output interval (exclusive end) generated from one source timing cell. */
export interface TimingCellOutputRange {
  start: number;
  end: number;
}

export interface PaintedDigitalTiming {
  cells: DigitalTimingCell[];
  /** Maps every original source-cell index to its output-cell interval. */
  sourceCellRanges: TimingCellOutputRange[];
}

export interface ErasedDigitalTiming extends PaintedDigitalTiming {
  /** Output cells whose represented interval was actually erased. */
  erasedOutputCells: number[];
}

export type DigitalTimingEraseResult =
  | (ErasedDigitalTiming & { ok: true })
  | { ok: false; reason: 'partial-clock-macro' };

/**
 * Paint an inclusive absolute document-tick range while preserving total lane
 * duration. Boundary cells are split into Undulate wave/period entries.
 */
export function paintDigitalTimingTicksWithMapping(
  timing: DigitalTiming,
  startTick: number,
  endTick: number,
  bitState: BitState,
  mode: 'set' | 'toggle',
): PaintedDigitalTiming {
  if (!canPaintDigitalTimingTicks(timing, startTick, endTick)) {
    return {
      cells: timing.cells.map((cell) => ({ ...cell })),
      sourceCellRanges: timing.cells.map((_, index) => ({
        start: index,
        end: index + 1,
      })),
    };
  }
  const lo = Math.min(Math.floor(startTick), Math.floor(endTick));
  const hiExclusive = Math.max(Math.floor(startTick), Math.floor(endTick)) + 1;
  const output: DigitalTimingCell[] = [];
  const sourceCellRanges: TimingCellOutputRange[] = [];
  let cursor = -timing.phaseTicks;

  for (const cell of timing.cells) {
    const outputStart = output.length;
    const cellStart = cursor;
    const cellEnd = cursor + cell.durationTicks;
    cursor = cellEnd;
    const overlapStart = Math.max(cellStart, lo);
    const overlapEnd = Math.min(cellEnd, hiExclusive);
    if (overlapStart >= overlapEnd) {
      output.push({ ...cell });
      sourceCellRanges.push({ start: outputStart, end: output.length });
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
      sourceCellRanges.push({ start: outputStart, end: output.length });
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
    sourceCellRanges.push({ start: outputStart, end: output.length });
  }

  return { cells: output, sourceCellRanges };
}

export function paintDigitalTimingTicks(
  timing: DigitalTiming,
  startTick: number,
  endTick: number,
  bitState: BitState,
  mode: 'set' | 'toggle',
): DigitalTimingCell[] {
  return paintDigitalTimingTicksWithMapping(
    timing,
    startTick,
    endTick,
    bitState,
    mode,
  ).cells;
}
