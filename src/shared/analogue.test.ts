import { describe, expect, it } from 'vitest';
import { normalizeAnalogueSignal } from './analogue';
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
});
