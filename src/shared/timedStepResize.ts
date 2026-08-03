import { isClockBitState } from './bitToggle';
import type { BitState, SignalTiming, TimedCell } from './types';

function cloneCell(cell: TimedCell, durationTicks: number, offsetTicks = 0): TimedCell {
  const dutyTicks = cell.dutyTicks === undefined
    ? undefined
    : Math.max(0, Math.min(durationTicks, cell.dutyTicks - offsetTicks));
  return {
    ...cell,
    durationTicks,
    ...(dutyTicks === undefined ? {} : { dutyTicks }),
  };
}

export function timingCellDuration(timing: SignalTiming): number {
  return timing.cells.reduce(
    (sum, cell) => sum + Math.max(1, Math.round(cell.durationTicks)),
    0,
  );
}

/** Resize a native timing track at an exact document-tick boundary. */
export function resizeTimingToDuration(
  timing: SignalTiming,
  targetDurationTicks: number,
): boolean {
  const target = Math.max(1, Math.floor(targetDurationTicks));
  if (!canResizeTimingToDuration(timing, target)) return false;
  const source = timing.cells.map((cell) => ({ ...cell }));
  const cells: TimedCell[] = [];
  let remaining = target;
  let index = 0;

  while (remaining > 0 && index < source.length) {
    const cell = source[index]!;
    const duration = Math.min(Math.max(1, Math.round(cell.durationTicks)), remaining);
    cells.push(cloneCell(cell, duration));
    remaining -= duration;
    index += 1;
  }

  const fallback = source.at(-1);
  while (remaining > 0) {
    const duration = Math.min(Math.max(1, timing.ticksPerStep), remaining);
    const dutyTicks = fallback?.dutyTicks === undefined
      ? undefined
      : Math.max(
        0,
        Math.min(
          duration,
          Math.round((fallback.dutyTicks / Math.max(1, fallback.durationTicks)) * duration),
        ),
      );
    cells.push({
      ...(fallback ? { ...fallback, ...(dutyTicks === undefined ? {} : { dutyTicks }) } : {}),
      durationTicks: duration,
    });
    remaining -= duration;
  }
  timing.cells = cells;
  return true;
}

function boundaryTick(timing: SignalTiming, majorIndex: number): number {
  return Math.max(
    0,
    Math.min(
      timingCellDuration(timing),
      majorIndex * Math.max(1, timing.ticksPerStep) + timing.phaseTicks,
    ),
  );
}

export type TimingBoundary =
  | { kind: 'exact'; index: number; tick: number }
  | { kind: 'inside'; index: number; offsetTicks: number; tick: number };

/** Locate a document boundary without losing whether it splits a source cell. */
export function timingBoundaryAtMajorStep(
  timing: SignalTiming,
  majorIndex: number,
): TimingBoundary {
  const target = boundaryTick(timing, majorIndex);
  let cursor = 0;
  for (let index = 0; index < timing.cells.length; index++) {
    const duration = Math.max(1, Math.round(timing.cells[index]!.durationTicks));
    if (target === cursor) return { kind: 'exact', index, tick: target };
    if (target < cursor + duration) {
      return { kind: 'inside', index, offsetTicks: target - cursor, tick: target };
    }
    cursor += duration;
  }
  return { kind: 'exact', index: timing.cells.length, tick: target };
}

function isClockCell(cell: TimedCell | undefined): boolean {
  return Boolean(
    cell
    && 'state' in cell
    && isClockBitState((cell as TimedCell & { state: BitState }).state),
  );
}

function rangeSplitsClockCell(timing: SignalTiming, start: number, end: number): boolean {
  let cursor = 0;
  for (const cell of timing.cells) {
    const cellEnd = cursor + Math.max(1, Math.round(cell.durationTicks));
    if (
      isClockCell(cell)
      && ((start > cursor && start < cellEnd) || (end > cursor && end < cellEnd))
    ) {
      return true;
    }
    cursor = cellEnd;
  }
  return false;
}

/**
 * Native resizing is intentionally conservative: a document-length edit must
 * never cut a clock macro or manufacture another complete clock cycle.
 */
export function canResizeTimingToDuration(
  timing: SignalTiming,
  targetDurationTicks: number,
): boolean {
  const target = Math.max(1, Math.floor(targetDurationTicks));
  const total = timingCellDuration(timing);
  if (target === total) return true;
  if (target < total) {
    return !rangeSplitsClockCell(timing, target, total);
  }
  const fallback = timing.cells.at(-1);
  return !fallback || !isClockCell(fallback);
}

/** Source-cell index at a major-step boundary (before that cell, if exact). */
export function majorStepBoundaryCellIndex(
  timing: SignalTiming,
  majorIndex: number,
): number {
  return timingBoundaryAtMajorStep(timing, majorIndex).index;
}

export function canInsertMajorStepInTiming(timing: SignalTiming, majorIndex: number): boolean {
  const boundary = timingBoundaryAtMajorStep(timing, majorIndex);
  if (boundary.kind === 'inside') return !isClockCell(timing.cells[boundary.index]!);
  return !isClockCell(timing.cells[boundary.index - 1]!)
    && !isClockCell(timing.cells[boundary.index]!);
}

/** Insert one major step at its document-tick boundary. */
export function insertMajorStepInTiming(
  timing: SignalTiming,
  majorIndex: number,
): boolean {
  const stepTicks = Math.max(1, timing.ticksPerStep);
  const cells = timing.cells.map((cell) => ({ ...cell }));
  const boundary = timingBoundaryAtMajorStep(timing, majorIndex);
  const index = boundary.index;
  if (
    (boundary.kind === 'inside' && isClockCell(cells[index]!))
    || (boundary.kind === 'exact'
      && (isClockCell(cells[index - 1]!) || isClockCell(cells[index]!)))
  ) return false;

  if (boundary.kind === 'inside') {
    const cell = cells[index]!;
    const before = boundary.offsetTicks;
    const insertedCell = 'state' in cell
      ? { state: (cell as TimedCell & { state: unknown }).state, durationTicks: stepTicks }
      : { durationTicks: stepTicks };
    cells.splice(
      index,
      1,
      cloneCell(cell, before),
      insertedCell,
      cloneCell(cell, cell.durationTicks - before, before),
    );
  } else {
    const reference = cells[index - 1] ?? cells[index];
    const state = reference && 'state' in reference
      ? { state: (reference as TimedCell & { state: unknown }).state }
      : {};
    cells.splice(index, 0, { ...state, durationTicks: stepTicks });
  }
  timing.cells = cells;
  return true;
}

export function canDeleteMajorStepInTiming(
  timing: SignalTiming,
  majorIndex: number,
  minimumMajorSteps: number,
): boolean {
  const stepTicks = Math.max(1, timing.ticksPerStep);
  const total = timingCellDuration(timing);
  const start = majorIndex * stepTicks + timing.phaseTicks;
  const end = start + stepTicks;
  // A lane can legitimately be empty before or after the deleted document
  // column. Let the global edit proceed and leave that lane untouched (or
  // advance a delayed phase in the before-lane case).
  if (end <= 0 || start >= total) return true;
  if (total <= Math.max(1, minimumMajorSteps) * stepTicks) return false;
  const overlapStart = Math.max(0, start);
  const overlapEnd = Math.min(total, end);
  return !rangeSplitsClockCell(timing, overlapStart, overlapEnd);
}

/** Delete one major step, preserving partial cells on either side. */
export function deleteMajorStepInTiming(
  timing: SignalTiming,
  majorIndex: number,
  minimumMajorSteps: number,
): boolean {
  const stepTicks = Math.max(1, timing.ticksPerStep);
  const total = timingCellDuration(timing);
  const start = majorIndex * stepTicks + timing.phaseTicks;
  const end = start + stepTicks;
  if (end <= 0) {
    timing.phaseTicks += stepTicks;
    return true;
  }
  if (start >= total) return false;
  if (total <= Math.max(1, minimumMajorSteps) * stepTicks) return false;
  const overlapStart = Math.max(0, start);
  const overlapEnd = Math.min(total, end);
  if (rangeSplitsClockCell(timing, overlapStart, overlapEnd)) return false;
  const cells: TimedCell[] = [];
  let cursor = 0;
  for (const source of timing.cells) {
    const cellStart = cursor;
    const cellEnd = cursor + source.durationTicks;
    const before = Math.max(0, Math.min(cellEnd, overlapStart) - cellStart);
    const after = Math.max(0, cellEnd - Math.max(cellStart, overlapEnd));
    if (before > 0) cells.push(cloneCell(source, before));
    if (after > 0) cells.push(cloneCell(source, after, source.durationTicks - after));
    cursor = cellEnd;
  }
  if (cells.length === 0) return false;
  timing.cells = cells;
  // If the deleted document interval began before this lane, its remaining
  // source now starts at the new document origin.
  if (start < 0) timing.phaseTicks = 0;
  return true;
}
