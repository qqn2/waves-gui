import { describe, expect, it } from 'vitest';
import { applyAnalogueBrushRange, normalizeAnalogueSignal } from './analogue';
import type { Signal } from './types';

function analogueSignal(): Signal {
  return {
    id: 'ana',
    name: 'vin',
    type: 'analogue',
    states: ['1'],
    segments: [],
    color: '#4A9EFF',
    rowHeight: 40,
    analogueMin: 2,
    analogueMax: 2,
    slewing: -3,
    vscale: 100,
    analogueCells: [
      {
        id: 'sample',
        kind: 'samples',
        value: Number.NaN,
        samples: [
          { offset: 2, value: 4 },
          { offset: -1, value: 3 },
          { offset: Number.NaN, value: 9 },
        ],
      },
    ],
  };
}

describe('analogue normalization', () => {
  it('keeps finite bounded ranges, samples, and one cell per step', () => {
    const signal = analogueSignal();
    normalizeAnalogueSignal(signal, 3);

    expect(signal.states).toEqual([]);
    expect(signal.analogueMin).toBe(2);
    expect(signal.analogueMax).toBe(3);
    expect(signal.slewing).toBe(0);
    expect(signal.vscale).toBe(16);
    expect(signal.analogueCells).toHaveLength(3);
    expect(signal.analogueCells?.[0]).toMatchObject({
      kind: 'samples',
      value: 4,
      samples: [
        { offset: 0, value: 3 },
        { offset: 1, value: 4 },
      ],
    });
  });

  it('pins painted symbolic analogue states to their semantic rails', () => {
    const signal = analogueSignal();
    signal.analogueMin = 0.2;
    signal.analogueMax = 3.3;
    normalizeAnalogueSignal(signal, 4);

    applyAnalogueBrushRange(signal, 0, 0, 'metastable-low', 99);
    applyAnalogueBrushRange(signal, 1, 1, 'metastable-high', -99);
    applyAnalogueBrushRange(signal, 2, 2, 'impulse-low', -99);
    applyAnalogueBrushRange(signal, 3, 3, 'impulse-high', 99);

    expect(signal.analogueCells?.map(({ kind, value }) => ({ kind, value })))
      .toEqual([
        { kind: 'metastable-low', value: 0.2 },
        { kind: 'metastable-high', value: 3.3 },
        { kind: 'impulse-low', value: 3.3 },
        { kind: 'impulse-high', value: 0.2 },
      ]);
  });
});
