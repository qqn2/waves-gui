import { describe, expect, it } from 'vitest';
import type { SignalOrGroup } from '../shared/types';
import { filterSignalTree } from './panelTree';

const tree: SignalOrGroup[] = [
  {
    id: 'axi',
    name: 'AXI Write Channel',
    type: 'group',
    children: [
      {
        id: 'awvalid',
        name: 'AWVALID',
        type: 'bit',
        states: ['0'],
        segments: [],
        color: '#4A9EFF',
        rowHeight: 40,
      },
      {
        id: 'blank',
        name: '',
        type: 'spacer',
        states: [],
        segments: [],
        color: '#4A9EFF',
        rowHeight: 40,
      },
    ],
  },
];

describe('signal panel filtering', () => {
  it('returns the full subtree when a group name matches', () => {
    const result = filterSignalTree(tree, 'write channel');
    expect(result).toHaveLength(1);
    expect(result[0]?.type === 'group' && result[0].children).toHaveLength(2);
  });

  it('returns only matching descendants when the group does not match', () => {
    const result = filterSignalTree(tree, 'awvalid');
    expect(result).toHaveLength(1);
    expect(result[0]?.type === 'group' && result[0].children.map((item) => item.id))
      .toEqual(['awvalid']);
  });
});
