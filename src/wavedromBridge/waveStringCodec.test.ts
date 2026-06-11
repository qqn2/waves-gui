import { describe, it, expect } from 'vitest';
import {
  encodeWaveString,
  encodeWaveStringForDiagram,
  decodeWaveString,
  decodeWaveDetail,
  normalizeWaveString,
  padDecodedWaveToLength,
} from './waveStringCodec';
import {
  toWavedromJSON,
  fromWavedromJSON,
  validateWavedromJSON,
} from './index';
import type { BitState, DiagramState, Signal, SignalGroup } from '../shared/types';
import type { WdRoot, WdSignal } from './wdTypes';

function isBitSignal(s: DiagramState['signals'][number]): s is Signal {
  return s.type === 'bit';
}

function isVectorSignal(s: DiagramState['signals'][number]): s is Signal {
  return s.type === 'vector';
}

function isSignalGroup(s: DiagramState['signals'][number]): s is SignalGroup {
  return s.type === 'group';
}

function canonicalWave(wave: string): string {
  return encodeWaveString(decodeWaveString(wave));
}

describe('encodeWaveString / decodeWaveString', () => {
  it('encodes run-length per WaveDrom convention', () => {
    expect(encodeWaveString(['1', '1', '1', '0', '0'])).toBe('1..0.');
    expect(encodeWaveString(['1', '0', '1', '0', '1'])).toBe('10101');
  });

  it('decodes continuation dots', () => {
    expect(decodeWaveString('1..0.')).toEqual(['1', '1', '1', '0', '0']);
    expect(decodeWaveString('1..00')).toEqual(['1', '1', '1', '0', '0']);
  });

  it('normalizes redundant explicit repeats after a dot', () => {
    expect(normalizeWaveString('0.1..0.0')).toBe('0.1..0.');
    expect(normalizeWaveString('1..00')).toBe('1..0.');
  });

  it('round-trips arbitrary bit patterns', () => {
    const patterns = ['10101', '1..00', 'p...n...', 'x1z0u.d'];
    for (const wave of patterns) {
      expect(encodeWaveString(decodeWaveString(wave))).toBe(
        canonicalWave(wave),
      );
    }
  });

  it('handles case-insensitive wave chars', () => {
    expect(decodeWaveString('XzP')).toEqual(['x', 'z', 'P']);
  });

  it('never encodes clock as per-step pnPn spam', () => {
    expect(encodeWaveString(['P', 'n', 'P', 'n'])).toBe('P...');
    expect(encodeWaveString(['p', 'n', 'p', 'n'])).toBe('p...');
    expect(encodeWaveString(['n', 'p', 'n', 'p', 'p', 'n', 'p', 'n'])).toBe(
      'n...p...',
    );
    expect(decodeWaveString('pnpn')).toEqual(['p', 'n', 'p', 'n']);
    expect(encodeWaveString(decodeWaveString('pnpn'))).toBe('p...');
  });

  it('encodes clock mixed with 0/1 using dotted clock runs, not n/p spam', () => {
    const states: BitState[] = ['P', '0', 'P', 'n', 'P', 'n', 'P', '1', 'P'];
    const wave = encodeWaveString(states);
    expect(wave).not.toMatch(/[pPnN]{2}/);
    expect(wave).not.toMatch(/nP|pN|Pn|Np/);
    expect(wave).toBe('P0P....1P');
    expect(decodeWaveString(wave)).toEqual(states);
  });

  it('does not emit Pn0..nPnPn when a 0 is painted into a clock lane', () => {
    const states: BitState[] = ['P', 'n', '0', 'P', 'n', 'P', 'n', 'P', 'n'];
    const wave = encodeWaveString(states);
    expect(wave).not.toMatch(/Pn|nP|pN|Np/);
    expect(wave).not.toMatch(/[pPnN]{2}/);
    expect(wave).toBe('P0.P.....');

    const doubleZero: BitState[] = ['P', 'n', '0', '0', 'n', 'P', 'n', 'P', 'n'];
    const wave2 = encodeWaveString(doubleZero);
    expect(wave2).not.toMatch(/Pn|nP|pN|Np/);
    expect(wave2).toBe('P0...P...');

    const repaired = normalizeWaveString('Pn0..nPnPn');
    expect(repaired).not.toMatch(/Pn|nP|pN|Np/);
    expect(normalizeWaveString(repaired)).toBe(repaired);
  });

  it('round-trips mixed clock and binary wave strings', () => {
    const wave = 'P0..P...1';
    expect(encodeWaveString(decodeWaveString(wave))).toBe(wave);
  });

  it('returns empty string for empty states', () => {
    expect(encodeWaveString([])).toBe('');
  });

  it('encodeWaveStringForDiagram pads wave to totalSteps with dots', () => {
    expect(
      encodeWaveStringForDiagram(['P', 'n', 'P', 'n'], 8),
    ).toBe('P.......');
    expect(
      encodeWaveStringForDiagram(['0', '0', '1', '1'], 8),
    ).toBe('0.1.....');
  });

  it('padDecodedWaveToLength grow repairs broken clock before appending dots', () => {
    const states = ['P', 'n', 'P', 'n', 'P', 'n', 'P', 'n', 'n', 'n'] as const;
    const padded = padDecodedWaveToLength(
      { states: [...states], stepGaps: [], stepGlitches: [] },
      11,
    );
    expect(encodeWaveStringForDiagram(padded.states, 11)).toBe('P..........');
    expect(encodeWaveString([...states])).toBe('P.........');
  });

  it('decodes explicit same-level repeats as glitches', () => {
    const d00 = decodeWaveDetail('00');
    expect(d00.states).toEqual(['0', '0']);
    expect(d00.stepGlitches[0]).toBe(true);

    const dHoldGlitch = decodeWaveDetail('0.0');
    expect(dHoldGlitch.states).toEqual(['0', '0']);
    expect(dHoldGlitch.stepGlitches[0]).toBe(true);
  });

  it('encodes glitches with explicit repeat chars, not dots', () => {
    expect(
      encodeWaveString(['1', '1', '1', '0', '0'], undefined, [false, false, false, true]),
    ).toBe('1..00');
    expect(
      encodeWaveString(['0', '0'], undefined, [true]),
    ).toBe('00');
  });

  it('encodes gap columns as | and |1 when level changes', () => {
    expect(encodeWaveString(['0', '0', '0', '1'], [false, false, true, false])).toBe(
      '0.|1',
    );
    expect(encodeWaveString(['0', '0', '1', '0'], [false, true, false, false])).toBe(
      '0|10',
    );
  });

  it('round-trips consecutive gap columns', () => {
    const wave = '0|||';
    const detail = decodeWaveDetail(wave);
    expect(detail.stepGaps.filter(Boolean).length).toBe(3);
    expect(encodeWaveString(detail.states, detail.stepGaps, detail.stepGlitches)).toBe(
      wave,
    );
  });

  it('round-trips mixed gaps and holds like reset_n example', () => {
    const wave = '10|.|.|||';
    const detail = decodeWaveDetail(wave);
    expect(
      encodeWaveString(detail.states, detail.stepGaps, detail.stepGlitches),
    ).toBe(wave);
    expect(detail.stepGaps.filter(Boolean).length).toBe(5);
  });

  it('round-trips waves that carry explicit glitches', () => {
    const wave = '1..00';
    const detail = decodeWaveDetail(wave);
    expect(
      encodeWaveString(detail.states, detail.stepGaps, detail.stepGlitches),
    ).toBe(wave);
  });
});

describe('validateWavedromJSON', () => {
  it('accepts valid root', () => {
    expect(
      validateWavedromJSON({ signal: [{ name: 'a', wave: '10' }] }),
    ).toBeNull();
  });

  it('accepts groups and blank rows', () => {
    expect(
      validateWavedromJSON({
        signal: [{}, ['grp', { name: 'a', wave: '1' }]],
        config: { hscale: 2 },
      }),
    ).toBeNull();
  });

  it('rejects non-object root', () => {
    expect(validateWavedromJSON(null)).toBe('Root must be an object');
  });

  it('rejects missing signal array', () => {
    expect(validateWavedromJSON({})).toBe('Missing or invalid signal array');
  });

  it('rejects invalid wave characters', () => {
    expect(
      validateWavedromJSON({ signal: [{ wave: '1a0' }] }),
    ).toMatch(/Invalid wave/);
  });

  it('rejects hscale out of range', () => {
    expect(
      validateWavedromJSON({ signal: [], config: { hscale: 5 } }),
    ).toBe('config.hscale must be a number from 1 to 4');
  });

  it('accepts fractional hscale', () => {
    expect(
      validateWavedromJSON({ signal: [], config: { hscale: 1.5 } }),
    ).toBeNull();
  });

  it('validates nested group entries', () => {
    expect(
      validateWavedromJSON({
        signal: [['g', { wave: 'bad!' }]],
      }),
    ).toMatch(/Invalid wave/);
  });
});

describe('fromWavedromJSON / toWavedromJSON round-trip', () => {
  it('extends clock lanes with dots when padded to diagram length', () => {
    const wd: WdRoot = {
      signal: [
        { name: 'clk', wave: 'P........' },
        { name: 'reset_n', wave: '10........' },
        { name: 'enable', wave: '0..1..0..1' },
      ],
      config: { hscale: 1 },
      head: { text: 'Clock and reset' },
    };
    const diagram = fromWavedromJSON(wd);
    expect(diagram.config.totalSteps).toBe(10);
    const back = toWavedromJSON(diagram);
    const clk = back.signal[0] as WdSignal;
    expect(clk.wave).toBe('P.........');
    expect(clk.wave).not.toMatch(/[pPnN]{2}/);
  });

  it('round-trips bit signal states', () => {
    const wd: WdRoot = {
      signal: [{ name: 'clk', wave: '10101' }],
      config: { hscale: 1 },
    };
    const diagram = fromWavedromJSON(wd);
    expect(isBitSignal(diagram.signals[0])).toBe(true);
    if (isBitSignal(diagram.signals[0])) {
      expect(diagram.signals[0].states).toEqual(['1', '0', '1', '0', '1']);
    }
    const back = toWavedromJSON(diagram);
    const sig = back.signal[0] as WdSignal;
    expect(sig.name).toBe('clk');
    expect(canonicalWave(sig.wave!)).toBe('10101');
  });

  it('round-trips groups including nesting', () => {
    const wd: WdRoot = {
      signal: [
        { name: 'top', wave: '10' },
        ['Outer', { name: 'inner', wave: '01' }, {}],
        ['Nested', ['Inner', { name: 'deep', wave: '11' }]],
      ],
    };
    const diagram = fromWavedromJSON(wd);
    expect(diagram.signals).toHaveLength(3);
    expect(isBitSignal(diagram.signals[0])).toBe(true);
    expect(isSignalGroup(diagram.signals[1])).toBe(true);
    expect(isSignalGroup(diagram.signals[2])).toBe(true);

    const back = toWavedromJSON(diagram);
    expect(back.signal).toHaveLength(3);
    expect(Array.isArray(back.signal[1])).toBe(true);
    expect(Array.isArray(back.signal[2])).toBe(true);
    const outer = back.signal[1] as [string, ...unknown[]];
    expect(outer[0]).toBe('Outer');
    expect(outer).toHaveLength(3);
  });

  it('assigns per-segment colors from wave digits 2-9', () => {
    const diagram = fromWavedromJSON({
      signal: [{ name: 'bus', wave: '234', data: ['A', 'B', 'C'] }],
    });
    const bus = diagram.signals[0];
    if (bus?.type === 'vector') {
      expect(bus.segments).toHaveLength(3);
      expect(bus.segments.map((s) => s.color)).toEqual([
        '#ffffff',
        '#ffffb4',
        '#ffe0b9',
      ]);
    }
  });

  it('round-trips vector bus with data', () => {
    const wd: WdRoot = {
      signal: [{ name: 'data', wave: '=..=..', data: ['AA', 'BB'] }],
    };
    const diagram = fromWavedromJSON(wd);
    expect(isVectorSignal(diagram.signals[0])).toBe(true);
    if (isVectorSignal(diagram.signals[0])) {
      expect(diagram.signals[0].segments.map((s) => s.value)).toEqual([
        'AA',
        'BB',
      ]);
    }
    const back = toWavedromJSON(diagram);
    const sig = back.signal[0] as WdSignal;
    expect(sig.data).toEqual(['AA', 'BB']);
    expect(sig.wave).toBe('=..=..');
  });

  it('round-trips diagram export then import', () => {
    const diagram: DiagramState = {
      version: 1,
      config: { totalSteps: 5, hscale: 2, head: { text: 't' } },
      edges: [],
      signals: [
        {
          id: '1',
          name: 'clk',
          type: 'bit',
          states: ['0', '1', '0', '1', '0'],
          segments: [],
          color: '#4A9EFF',
          rowHeight: 40,
        },
      ],
    };
    const reimported = fromWavedromJSON(toWavedromJSON(diagram));
    expect(reimported.config.totalSteps).toBe(5);
    expect(reimported.config.hscale).toBe(2);
    expect(reimported.config.head).toEqual({ text: 't' });
    const orig = diagram.signals[0];
    if (isBitSignal(reimported.signals[0]) && isBitSignal(orig)) {
      expect(reimported.signals[0].states).toEqual(orig.states);
    }
  });

  it('handles missing wave as all-zero bit signal', () => {
    const diagram = fromWavedromJSON({ signal: [{ name: 'empty' }] });
    if (isBitSignal(diagram.signals[0])) {
      expect(diagram.signals[0].states).toEqual(['0']);
    }
  });

  it('pads shorter waves to longest signal', () => {
    const wd: WdRoot = {
      signal: [{ name: 'a', wave: '1010' }, { name: 'b', wave: '1' }],
    };
    const diagram = fromWavedromJSON(wd);
    expect(diagram.config.totalSteps).toBe(4);
    if (isBitSignal(diagram.signals[1])) {
      expect(diagram.signals[1].states).toEqual(['1', '1', '1', '1']);
    }
  });

  it('preserves spacer rows', () => {
    const wd: WdRoot = { signal: [{ name: 'a', wave: '1' }, {}] };
    const back = toWavedromJSON(fromWavedromJSON(wd));
    expect(back.signal[1]).toEqual({});
  });
});
