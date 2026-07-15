import { describe, expect, it } from 'vitest';
import {
  applyClockBrushToRange,
  applyClockToggleToRange,
  decodeClockWave,
  encodeClockWaveString,
  isClockWaveString,
  isRepeatingClockWave,
  scanClockRuns,
} from './clockWave';
import { decodeWaveDetail, encodeWaveString, padBitStatesToLength } from './waveStringCodec';

describe('clockWave', () => {
  it('accepts repeating clocks and adjacent clock-head changes', () => {
    expect(isRepeatingClockWave('P........')).toBe(true);
    expect(isClockWaveString('n...p...')).toBe(true);
    expect(isClockWaveString('Pn.pN')).toBe(true);
    expect(isClockWaveString('01')).toBe(false);
  });

  it('decodes each WaveDrom character as one complete clock cycle', () => {
    expect(decodeClockWave('P...').states).toEqual(['P', 'P', 'P', 'P']);
    expect(decodeClockWave('n...').states).toEqual(['n', 'n', 'n', 'n']);
  });

  it('preserves clock phase changes without manufacturing alternating columns', () => {
    const { states } = decodeClockWave('n...p...');
    expect(states).toEqual(['n', 'n', 'n', 'n', 'p', 'p', 'p', 'p']);
    expect(encodeClockWaveString(states)).toBe('n...p...');
  });

  it('round-trips a positive-edge arrow clock', () => {
    const wave = 'P........';
    const decoded = decodeWaveDetail(wave);
    expect(decoded.states.every((state) => state === 'P')).toBe(true);
    expect(encodeWaveString(decoded.states, decoded.stepGaps)).toBe(wave);
  });

  it('encodes identical cycles with dots and explicit phase changes with heads', () => {
    expect(encodeClockWaveString(['P', 'P', 'P', 'P'])).toBe('P...');
    expect(encodeClockWaveString(['P', 'P', 'N', 'N'])).toBe('P.N.');
    expect(scanClockRuns(['n', 'n', 'p', 'p'])).toHaveLength(2);
  });

  it('does not rewrite valid adjacent clock heads', () => {
    const states = ['P', 'n', 'P', 'n'] as const;
    expect(encodeClockWaveString([...states])).toBe('PnPn');
  });

  it('paints only the requested clock cycles', () => {
    const states = decodeClockWave('P.....').states;
    applyClockBrushToRange(states, 2, 3, 'n');
    expect(states).toEqual(['P', 'P', 'n', 'n', 'P', 'P']);
    expect(encodeClockWaveString(states)).toBe('P.n.P.');
  });

  it('toggles only the selected cycle and preserves arrow style', () => {
    const states = decodeClockWave('P........').states;
    applyClockToggleToRange(states, 2, 2);
    expect(states[1]).toBe('P');
    expect(states[2]).toBe('N');
    expect(states[3]).toBe('P');
    expect(encodeClockWaveString(states)).toBe('P.NP.....');
  });

  it('padding preserves a locally toggled clock cycle', () => {
    const states = decodeClockWave('P...').states;
    applyClockToggleToRange(states, 1, 1);
    const padded = padBitStatesToLength(states, 6);
    expect(padded).toEqual(['P', 'N', 'P', 'P', 'P', 'P']);
    expect(encodeClockWaveString(padded)).toBe('PNP...');
  });
});
