import { describe, expect, it } from 'vitest';
import { paintDigitalTimingTicks } from './fineTiming';

describe('fine timing paint', () => {
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
});
