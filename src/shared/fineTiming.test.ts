import { describe, expect, it } from 'vitest';
import {
  paintDigitalTimingTicks,
  timingForCellCount,
  timingDurationTicks,
} from './fineTiming';

describe('fine timing paint', () => {
  it('preserves an explicit zero period while keeping duration sums non-negative', () => {
    const timing = timingForCellCount(3, 1, { periods: [0, 1, 2] });
    expect(timing.cells.map((cell) => cell.durationTicks)).toEqual([0, 1, 2]);
    expect(timingDurationTicks(timing)).toBe(3);
  });

  it('splits a timing cell at painted document ticks without changing duration', () => {
    const cells = paintDigitalTimingTicks(
      {
        ticksPerStep: 4,
        phaseTicks: 0,
        cells: [
          { state: '0', durationTicks: 4 },
          { state: '1', durationTicks: 4 },
        ],
      },
      1,
      2,
      '1',
      'set',
    );

    expect(cells).toEqual([
      { state: '0', durationTicks: 1 },
      { state: '1', durationTicks: 2 },
      { state: '0', durationTicks: 1 },
      { state: '1', durationTicks: 4 },
    ]);
    expect(cells.reduce((sum, cell) => sum + cell.durationTicks, 0)).toBe(8);
  });

  it('accounts for signal phase when locating an absolute document tick', () => {
    const cells = paintDigitalTimingTicks(
      {
        ticksPerStep: 4,
        phaseTicks: 1,
        cells: [{ state: '0', durationTicks: 4 }],
      },
      0,
      0,
      '1',
      'set',
    );

    expect(cells).toEqual([
      { state: '0', durationTicks: 1 },
      { state: '1', durationTicks: 1 },
      { state: '0', durationTicks: 2 },
    ]);
  });

  it('does not split a complete clock macro into additional clock cycles', () => {
    const timing = {
      ticksPerStep: 4,
      phaseTicks: 0,
      cells: [{ state: 'P' as const, durationTicks: 4 }],
    };

    expect(paintDigitalTimingTicks(timing, 1, 1, '1', 'set')).toEqual(
      timing.cells,
    );
  });
});
