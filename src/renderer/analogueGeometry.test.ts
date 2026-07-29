import { describe, expect, it } from 'vitest';
import type { Signal } from '../shared/types';
import { analoguePathPoints } from './analogueGeometry';

const signal: Signal = {
  id: 'ana',
  name: 'vin',
  type: 'analogue',
  states: [],
  segments: [],
  color: '#4A9EFF',
  rowHeight: 40,
  analogueMin: 0,
  analogueMax: 2,
  analogueCells: [
    { id: 'step', kind: 'step', value: 1 },
    { id: 'cap', kind: 'capacitive', value: 2 },
    {
      id: 'samples',
      kind: 'samples',
      value: 0,
      samples: [
        { offset: 0, value: 2 },
        { offset: 0.5, value: 1 },
        { offset: 1, value: 0 },
      ],
    },
  ],
};

describe('analogue geometry', () => {
  it('builds deterministic step, capacitive, and sample paths', () => {
    const points = analoguePathPoints(signal);
    expect(points[0]).toEqual({ step: 0, value: 0 });
    expect(points).toContainEqual({ step: 0, value: 1 });
    expect(points).toContainEqual({ step: 1, value: 1 });
    expect(points.some((point) => point.step > 1 && point.step < 2)).toBe(true);
    expect(points).toContainEqual({ step: 2.5, value: 1 });
    expect(points.at(-1)).toEqual({ step: 3, value: 0 });
  });

  it('builds rail-resolving metastability and impulse geometry', () => {
    const mixed: Signal = {
      ...signal,
      analogueCells: [
        { id: 'm', kind: 'metastable-low', value: 0 },
        { id: 'M', kind: 'metastable-high', value: 2 },
        { id: 'i', kind: 'impulse-low', value: 2 },
        { id: 'I', kind: 'impulse-high', value: 0 },
      ],
    };
    const points = analoguePathPoints(mixed);
    expect(points.some((point) => point.step > 0 && point.step < 0.75))
      .toBe(true);
    expect(points).toContainEqual({ step: 1, value: 0 });
    expect(points).toContainEqual({ step: 2, value: 2 });
    expect(points).toContainEqual({ step: 2.5, value: 0 });
    expect(points).toContainEqual({ step: 3.5, value: 2 });
    expect(points.at(-1)).toEqual({ step: 4, value: 0 });
  });
});
