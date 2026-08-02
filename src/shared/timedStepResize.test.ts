import { describe, expect, it } from 'vitest';
import {
  insertMajorStepInTiming,
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
    expect(timingBoundaryAtMajorStep(value, 99)).toMatchObject({ kind: 'exact', index: 4, tick: 7 });
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
});
