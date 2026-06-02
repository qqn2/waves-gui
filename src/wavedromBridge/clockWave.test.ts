import { describe, expect, it } from 'vitest';
import {
  decodeClockWave,
  decodeExpandedClockWave,
  encodeClockWaveString,
  encodeRepeatingClockWave,
  isClockWaveString,
  isRepeatingClockWave,
  scanClockRuns,
} from './clockWave';
import { decodeWaveDetail, encodeWaveString } from './waveStringCodec';

describe('clockWave', () => {
  it('detects clock wave strings', () => {
    expect(isRepeatingClockWave('P........')).toBe(true);
    expect(isClockWaveString('n...p...')).toBe(true);
    expect(isClockWaveString('01')).toBe(false);
  });

  it('expands P... into alternating P/n steps', () => {
    const { states } = decodeClockWave('P...');
    expect(states).toEqual(['P', 'n', 'P', 'n']);
  });

  it('expands n... into alternating n/p steps', () => {
    const { states } = decodeClockWave('n...');
    expect(states).toEqual(['n', 'p', 'n', 'p']);
  });

  it('decodes phase change as n...p... not pnPn', () => {
    const { states } = decodeClockWave('n...p...');
    expect(states).toEqual(['n', 'p', 'n', 'p', 'p', 'n', 'p', 'n']);
    expect(encodeClockWaveString(states)).toBe('n...p...');
  });

  it('round-trips single-run clock through codec', () => {
    const wave = 'P........';
    const { states, stepGaps } = decodeWaveDetail(wave);
    expect(states[0]).toBe('P');
    expect(states[1]).toBe('n');
    expect(encodeWaveString(states, stepGaps)).toBe(wave);
  });

  it('collapses painted alternating clock to dotted wave string', () => {
    const states = ['P', 'n', 'P', 'n', 'P', 'n'] as const;
    expect(encodeRepeatingClockWave([...states])).toBe('P.....');
  });

  it('collapses two phase runs into n...p...', () => {
    const states = ['n', 'p', 'n', 'p', 'p', 'n', 'p', 'n'] as const;
    const runs = scanClockRuns([...states]);
    expect(runs).toHaveLength(2);
    expect(encodeClockWaveString([...states])).toBe('n...p...');
  });

  it('rejects non-alternating clock for collapse', () => {
    expect(encodeClockWaveString(['P', 'p', 'N', 'n'])).toBe(null);
  });

  it('repairs expanded pnpn import to dotted form on export', () => {
    const decoded = decodeExpandedClockWave('pnpnpnpn');
    expect(decoded?.states).toEqual(['p', 'n', 'p', 'n', 'p', 'n', 'p', 'n']);
    expect(encodeWaveString(decoded!.states)).toBe('p.......');
  });
});
