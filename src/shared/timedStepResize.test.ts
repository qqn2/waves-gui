import { describe, expect, it } from 'vitest';
import {
  canDeleteMajorStepInTiming,
  canInsertMajorStepInTiming,
  canResizeTimingToDuration,
  deleteMajorStepInTiming,
  insertMajorStepInTiming,
  resizeTimingToDuration,
  timingBoundaryAtMajorStep,
} from './timedStepResize';
import type { DigitalTiming } from './types';

function timing(
  durations: number[],
  states = durations.map((_, index) => String(index)),
  phaseTicks = 0,
): DigitalTiming {
  return {
    ticksPerStep: 2,
    phaseTicks,
    cells: durations.map((durationTicks, index) => ({
      durationTicks,
      state: states[index] as DigitalTiming['cells'][number]['state'],
    })),
  };
}

describe('native timing boundaries', () => {
  it('distinguishes exact, interior and final boundaries', () => {
    const value = timing([1, 1, 3, 2]);
    expect(timingBoundaryAtMajorStep(value, 1)).toMatchObject({ kind: 'exact', index: 2, tick: 2 });
    expect(timingBoundaryAtMajorStep(value, 2)).toMatchObject({ kind: 'inside', index: 2, offsetTicks: 2, tick: 4 });
    expect(timingBoundaryAtMajorStep(value, 3)).toMatchObject({ kind: 'inside', index: 3, offsetTicks: 1, tick: 6 });
    expect(timingBoundaryAtMajorStep(value, 99)).toMatchObject({ kind: 'after', index: 4, tick: 198 });
  });

  it('inserts at the exact boundary and preserves nonuniform source order', () => {
    const value = timing([1, 1, 3, 2]);
    expect(insertMajorStepInTiming(value, 1)).toBe(true);
    expect(value.cells.map((cell) => cell.state)).toEqual(['0', '1', '1', '2', '3']);
    expect(value.cells.map((cell) => cell.durationTicks)).toEqual([1, 1, 2, 3, 2]);
  });

  it('uses the phase-adjusted boundary for negative phase', () => {
    const value = timing([2, 2], ['a', 'b'], -1);
    expect(timingBoundaryAtMajorStep(value, 1)).toMatchObject({ kind: 'inside', index: 0, offsetTicks: 1, tick: 1 });
    expect(insertMajorStepInTiming(value, 1)).toBe(true);
    expect(value.cells.map((cell) => cell.durationTicks)).toEqual([1, 2, 1, 2]);
  });

  it('rejects insertion adjacent to a clock macro instead of creating another cycle', () => {
    const value = timing([2], ['P']);
    expect(insertMajorStepInTiming(value, 0)).toBe(false);
    expect(insertMajorStepInTiming(value, 1)).toBe(false);
    expect(value.cells).toHaveLength(1);
  });

  it('rejects resizing through a clock macro and ignores outside-lane deletes', () => {
    const value = timing([2, 2], ['P', '0']);
    expect(canResizeTimingToDuration(value, 1)).toBe(false);
    const before = value.cells.map((cell) => ({ ...cell }));
    expect(deleteMajorStepInTiming(value, 5, 1)).toBe(false);
    expect(value.cells).toEqual(before);
  });

  it('consumes an empty delayed prefix by advancing the lane phase', () => {
    const value = timing([2, 2], ['0', '1'], -2);
    expect(canDeleteMajorStepInTiming(value, 0, 1)).toBe(true);
    expect(deleteMajorStepInTiming(value, 0, 1)).toBe(true);
    expect(value.phaseTicks).toBe(0);
    expect(value.cells.map((cell) => cell.durationTicks)).toEqual([2, 2]);
  });

  it('allows a global delete after a positive-phase lane without touching it', () => {
    const value = timing([2, 2], ['0', '1'], 2);
    expect(canDeleteMajorStepInTiming(value, 2, 1)).toBe(true);
    expect(deleteMajorStepInTiming(value, 2, 1)).toBe(false);
    expect(value.phaseTicks).toBe(2);
    expect(value.cells.map((cell) => cell.durationTicks)).toEqual([2, 2]);
  });

  it('shifts a delayed lane left when inserting before its source', () => {
    const value = timing([2, 2], ['0', '1'], -2);
    expect(timingBoundaryAtMajorStep(value, 0)).toMatchObject({ kind: 'before', tick: -2 });
    expect(canInsertMajorStepInTiming(value, 0)).toBe(true);
    expect(insertMajorStepInTiming(value, 0)).toBe(true);
    expect(value.phaseTicks).toBe(-4);
    expect(value.cells.map((cell) => cell.durationTicks)).toEqual([2, 2]);
  });

  it('does not extend a lane when inserting after its source duration', () => {
    const value = timing([2, 2], ['0', '1']);
    expect(timingBoundaryAtMajorStep(value, 3)).toMatchObject({ kind: 'after', tick: 6 });
    expect(canInsertMajorStepInTiming(value, 3)).toBe(true);
    expect(insertMajorStepInTiming(value, 3)).toBe(false);
    expect(value.cells.map((cell) => cell.durationTicks)).toEqual([2, 2]);
  });

  it('advances past collapsed source cells without consuming resize duration', () => {
    const value = timing([0, 2]);
    expect(canResizeTimingToDuration(value, 2)).toBe(true);
    expect(resizeTimingToDuration(value, 2)).toBe(true);
    expect(value.cells.map((cell) => cell.durationTicks)).toEqual([0, 2]);
  });
});
