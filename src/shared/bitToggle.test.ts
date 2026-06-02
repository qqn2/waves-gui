import { describe, expect, it } from 'vitest';
import { toggleBinaryBitState } from './bitToggle';

describe('toggleBinaryBitState', () => {
  it('flips 0 and 1', () => {
    expect(toggleBinaryBitState('0')).toBe('1');
    expect(toggleBinaryBitState('1')).toBe('0');
  });

  it('flips clock polarity p and n', () => {
    expect(toggleBinaryBitState('p')).toBe('n');
    expect(toggleBinaryBitState('n')).toBe('p');
  });

  it('leaves x, z, u, d unchanged', () => {
    for (const st of ['x', 'z', 'u', 'd'] as const) {
      expect(toggleBinaryBitState(st)).toBe(st);
    }
  });
});
