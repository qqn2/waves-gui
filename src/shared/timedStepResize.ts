import type { SignalTiming, TimedCell } from './types';

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
): void {
  const target = Math.max(1, Math.floor(targetDurationTicks));
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
    cells.push({
      ...(fallback ? { ...fallback, dutyTicks: undefined } : {}),
      durationTicks: duration,
    });
    remaining -= duration;
  }
  timing.cells = cells;
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

/** Source-cell index at a major-step boundary (before that cell, if exact). */
export function majorStepBoundaryCellIndex(
  timing: SignalTiming,
  majorIndex: number,
): number {
  const target = boundaryTick(timing, majorIndex);
  let cursor = 0;
  for (let index = 0; index < timing.cells.length; index++) {
    const end = cursor + timing.cells[index]!.durationTicks;
    if (target <= cursor) return index;
    if (target < end) return index;
    cursor = end;
  }
  return timing.cells.length;
}

/** Insert one major step at its document-tick boundary. */
export function insertMajorStepInTiming(
  timing: SignalTiming,
  majorIndex: number,
): void {
  const stepTicks = Math.max(1, timing.ticksPerStep);
  const target = boundaryTick(timing, majorIndex);
  const cells = timing.cells.map((cell) => ({ ...cell }));
  let cursor = 0;
  let index = 0;
  while (index < cells.length && cursor + cells[index]!.durationTicks < target) {
    cursor += cells[index]!.durationTicks;
    index += 1;
  }

  if (index < cells.length && target > cursor && target < cursor + cells[index]!.durationTicks) {
    const cell = cells[index]!;
    const before = target - cursor;
    cells.splice(
      index,
      1,
      cloneCell(cell, before),
      { durationTicks: stepTicks },
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
}

/** Delete one major step, preserving partial cells on either side. */
export function deleteMajorStepInTiming(
  timing: SignalTiming,
  majorIndex: number,
  minimumMajorSteps: number,
): boolean {
  const stepTicks = Math.max(1, timing.ticksPerStep);
  const total = timingCellDuration(timing);
  if (total <= Math.max(1, minimumMajorSteps) * stepTicks) return false;
  const start = Math.max(0, Math.min(Math.max(0, total - stepTicks), boundaryTick(timing, majorIndex)));
  const end = Math.min(total, start + stepTicks);
  const cells: TimedCell[] = [];
  let cursor = 0;
  for (const source of timing.cells) {
    const cellStart = cursor;
    const cellEnd = cursor + source.durationTicks;
    const before = Math.max(0, Math.min(cellEnd, start) - cellStart);
    const after = Math.max(0, cellEnd - Math.max(cellStart, end));
    if (before > 0) cells.push(cloneCell(source, before));
    if (after > 0) cells.push(cloneCell(source, after, source.durationTicks - after));
    cursor = cellEnd;
  }
  if (cells.length === 0) return false;
  timing.cells = cells;
  return true;
}
