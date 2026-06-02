import { describe, it, expect } from 'vitest';
import { encodeWaveString, decodeWaveString } from './waveStringCodec';
import {
  toWavedromJSON,
  fromWavedromJSON,
  validateWavedromJSON,
} from './index';
import type { DiagramState, Signal, SignalGroup } from '../shared/types';
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
    expect(encodeWaveString(['1', '1', '1', '0', '0'])).toBe('1..00');
    expect(encodeWaveString(['1', '0', '1', '0', '1'])).toBe('10101');
  });

  it('decodes continuation dots', () => {
    expect(decodeWaveString('1..00')).toEqual(['1', '1', '1', '0', '0']);
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
    expect(decodeWaveString('XzP')).toEqual(['x', 'z', 'p']);
  });

  it('returns empty string for empty states', () => {
    expect(encodeWaveString([])).toBe('');
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
    ).toBe('config.hscale must be 1–4');
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

  it('does not assign per-segment colors from wave digits 2-9', () => {
    const diagram = fromWavedromJSON({
      signal: [{ name: 'bus', wave: '234', data: ['A', 'B', 'C'] }],
    });
    const bus = diagram.signals[0];
    if (bus?.type === 'vector') {
      expect(bus.segments.every((s) => s.color === undefined)).toBe(true);
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
      annotations: [],
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
