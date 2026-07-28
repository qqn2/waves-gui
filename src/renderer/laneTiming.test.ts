import { describe, expect, it } from 'vitest';
import type { Signal } from '../shared/types';
import {
  laneLogicalWidth,
  stepLogicalCenter,
  stepLogicalXEnd,
  stepAtLogicalXForSignal,
} from './laneTiming';

const base: Signal = {
  id: '1',
  name: 's',
  type: 'bit',
  states: ['0', '0', '0'],
  segments: [],
  color: '#4af',
  rowHeight: 40,
};

describe('laneTiming', () => {
  it('stretches columns with period', () => {
    const sig = { ...base, period: 2 };
    expect(stepLogicalXEnd(sig, 0)).toBe(40 * 2);
    expect(laneLogicalWidth(sig, 3)).toBeGreaterThan(40 * 3);
  });

  it('moves positive phase toward the past like WaveDrom', () => {
    const sig = { ...base, phase: 0.5 };
    expect(stepLogicalCenter(sig, 0)).toBe(0);
  });

  it('does not multiply phase displacement by period', () => {
    const sig = { ...base, phase: 0.5, period: 3 };
    expect(stepLogicalXEnd(sig, 0)).toBe(100);
  });

  it('accumulates integer-tick cell durations for geometry and hit testing', () => {
    const sig: Signal = {
      ...base,
      digitalTiming: {
        ticksPerStep: 4,
        phaseTicks: 1,
        cells: [
          { state: '0', durationTicks: 2 },
          { state: '0', durationTicks: 4 },
          { state: '0', durationTicks: 6 },
        ],
      },
    };
    expect(stepLogicalXEnd(sig, 0)).toBe(10);
    expect(stepLogicalXEnd(sig, 1)).toBe(50);
    expect(stepLogicalXEnd(sig, 2)).toBe(110);
    expect(stepAtLogicalXForSignal(30, sig, 3)).toBe(1);
    expect(stepAtLogicalXForSignal(80, sig, 3)).toBe(2);
  });
});
