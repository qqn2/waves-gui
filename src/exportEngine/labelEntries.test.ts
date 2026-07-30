import { describe, expect, it } from 'vitest';
import type { Signal } from '../shared/types';
import { buildLabelEntries } from './labelEntries';

function signal(id: string, order: number): Signal {
  return {
    id,
    name: id,
    type: 'analogue',
    states: [],
    segments: [],
    color: '#4A9EFF',
    rowHeight: 40,
    order,
    analogueCells: [],
  };
}

describe('label entries', () => {
  it('maps Undulate overlay label order to distinct row positions', () => {
    const entries = buildLabelEntries([
      signal('top', 1),
      signal('middle', 0),
      signal('bottom', 4),
    ]);

    expect(entries.map((entry) => entry.centerRatio)).toEqual([
      0.14,
      0.5,
      0.86,
    ]);
  });
});
