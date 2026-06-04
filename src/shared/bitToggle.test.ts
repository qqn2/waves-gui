import { describe, expect, it } from 'vitest';
import {
  invertClockBitState,
  isClockBitState,
  isHoldPaintValue,
  resolvePaintValue,
  toggleBinaryBitState,
} from './bitToggle';

describe('toggleBinaryBitState', () => {
  it('flips 0 and 1', () => {
    expect(toggleBinaryBitState('0')).toBe('1');
    expect(toggleBinaryBitState('1')).toBe('0');
  });

  it('inverts clock phase (rise↔fall), not P↔N', () => {
    expect(toggleBinaryBitState('p')).toBe('n');
    expect(toggleBinaryBitState('P')).toBe('n');
    expect(toggleBinaryBitState('n')).toBe('p');
    expect(toggleBinaryBitState('N')).toBe('p');
  });

  it('preserves alternation when toggling a clock pattern', () => {
    const before = ['P', 'n', 'P', 'n'] as const;
    const after = before.map((s) => toggleBinaryBitState(s));
    expect(after).toEqual(['n', 'p', 'n', 'p']);
  });

  it('leaves x, z, u, d, and hold paint unchanged', () => {
    for (const st of ['x', 'z', 'u', 'd', '.'] as const) {
      expect(toggleBinaryBitState(st)).toBe(st);
    }
  });
});

describe('resolvePaintValue', () => {
  it('copies the previous step for hold (.)', () => {
    expect(isHoldPaintValue('.')).toBe(true);
    expect(resolvePaintValue(['1', '0', '1'], 1, '.')).toBe('1');
    expect(resolvePaintValue(['1', '0', '1'], 2, '.')).toBe('0');
    expect(resolvePaintValue(['1', '0', '1'], 0, '.')).toBe('0');
  });
});

describe('isClockBitState', () => {
  it('recognizes clock wave chars', () => {
    expect(isClockBitState('p')).toBe(true);
    expect(isClockBitState('1')).toBe(false);
  });
});

describe('invertClockBitState', () => {
  it('maps rise to fall and fall to rise', () => {
    expect(invertClockBitState('P')).toBe('n');
    expect(invertClockBitState('N')).toBe('p');
  });
});
