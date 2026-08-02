import { describe, expect, it } from 'vitest';
import type { Signal, SignalGroup } from '../shared/types';
import { buildRowLayout, totalContentHeight } from './rowLayout';

function analogue(
  id: string,
  rowHeight: number,
  overlay = false,
): Signal {
  return {
    id,
    name: id,
    type: 'analogue',
    states: [],
    segments: [],
    color: '#4A9EFF',
    rowHeight,
    overlay,
    analogueCells: [],
  };
}

describe('row layout', () => {
  it('shares the largest row across an Undulate overlay chain', () => {
    const rows = buildRowLayout([
      analogue('a', 40, true),
      analogue('b', 80, true),
      analogue('c', 60),
      analogue('d', 40),
    ]);

    expect(rows).toMatchObject([
      { id: 'a', y: 0, height: 80 },
      { id: 'b', y: 0, height: 80 },
      { id: 'c', y: 0, height: 80 },
      { id: 'd', y: 80, height: 40 },
    ]);
    expect(totalContentHeight(rows)).toBe(120);
  });

  it('uses session collapse ids without changing the signal tree', () => {
    const group: SignalGroup = {
      id: 'group',
      name: 'Inputs',
      type: 'group',
      children: [analogue('nested', 40)],
    };

    expect(buildRowLayout([group]).map((row) => row.id)).toEqual([
      'group',
      'nested',
    ]);
    expect(buildRowLayout([group], ['group']).map((row) => row.id)).toEqual([
      'group',
    ]);
    expect(group).not.toHaveProperty('collapsed');
  });
});
