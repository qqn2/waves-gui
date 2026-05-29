import { describe, expect, it } from 'vitest';
import { toggleBinaryBitState } from './bitToggle';

describe('toggleBinaryBitState', () => {
  it('flips 0 and 1', () => {
    expect(toggleBinaryBitState('0')).toBe('1');
    expect(toggleBinaryBitState('1')).toBe('0');
  });
});
