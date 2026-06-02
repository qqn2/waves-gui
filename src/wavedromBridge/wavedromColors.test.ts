import { describe, expect, it } from 'vitest';
import {
  colorIndexFromFillHex,
  colorIndexToWaveChar,
  fillHexForColorIndex,
  waveCharToColorIndex,
} from './wavedromColors';

describe('wavedromColors', () => {
  it('maps wave chars to color indices', () => {
    expect(waveCharToColorIndex('=')).toBe(2);
    expect(waveCharToColorIndex('5')).toBe(5);
    expect(waveCharToColorIndex('x')).toBeNull();
  });

  it('round-trips index through wave char', () => {
    expect(colorIndexToWaveChar(2)).toBe('=');
    expect(colorIndexToWaveChar(7)).toBe('7');
  });

  it('uses default skin fill hex values', () => {
    expect(fillHexForColorIndex(3)).toBe('#ffffb4');
    expect(colorIndexFromFillHex('#ffffb4')).toBe(3);
  });
});
