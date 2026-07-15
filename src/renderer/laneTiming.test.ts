import { describe, expect, it } from 'vitest';
import type { Signal } from '../shared/types';
import {
  laneLogicalWidth,
  stepLogicalCenter,
  stepLogicalXEnd,
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
});
