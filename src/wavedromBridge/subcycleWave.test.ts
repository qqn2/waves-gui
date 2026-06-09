import { describe, expect, it } from 'vitest';
import {
  expandWaveToColumns,
  hasSubcycleSyntax,
  padWaveOverride,
  waveColumnCount,
} from './subcycleWave';

describe('subcycleWave', () => {
  it('detects sub-cycle markers', () => {
    expect(hasSubcycleSyntax('01<x>1')).toBe(true);
    expect(hasSubcycleSyntax('0101')).toBe(false);
  });

  it('counts columns for a simple wave', () => {
    expect(waveColumnCount('0101', 1, 1)).toBe(4);
    expect(waveColumnCount('0..1', 1, 1)).toBe(4);
  });

  it('expands sub-cycle columns with multiple levels', () => {
    const cols = expandWaveToColumns('0<1>1', 1, 1);
    expect(cols.length).toBeGreaterThan(0);
    expect(cols.some((c) => c.levels.length > 1)).toBe(true);
  });

  it('pads wave override with continuation dots', () => {
    expect(padWaveOverride('01', 4, 1, 1)).toBe('01..');
  });
});
