import { describe, expect, it } from 'vitest';
import type { DiagramState } from '../shared/types';
import {
  allocateNodeChar,
  formatArrowEdge,
  formatTimespanEdge,
  padNodeString,
  setNodeCharAt,
} from './nodeString';

function diagramWithNode(node: string): DiagramState {
  return {
    version: 1,
    config: { totalSteps: 8, hscale: 1 },
    edges: [],
    annotations: [],
    signals: [
      {
        id: 's0',
        name: 'A',
        type: 'bit',
        states: Array(8).fill('0'),
        segments: [],
        color: '#4af',
        rowHeight: 40,
        node,
      },
    ],
  };
}

describe('nodeString', () => {
  it('pads node strings to totalSteps', () => {
    expect(padNodeString('a..', 6)).toBe('a.....');
  });

  it('allocates unused letters', () => {
    const d = diagramWithNode('a.......');
    expect(allocateNodeChar(d)).toBe('A');
  });

  it('formats WaveDrom edge strings', () => {
    expect(formatArrowEdge('a', 'b', 't1')).toBe('a->b t1');
    expect(formatTimespanEdge('I', 'J', '5 ms')).toBe('I+J 5 ms');
  });

  it('sets and clears node characters', () => {
    const d = diagramWithNode('........');
    const sig = d.signals[0] as import('../shared/types').Signal;
    setNodeCharAt(sig, 2, 'x', 8);
    expect(sig.node?.[2]).toBe('x');
    setNodeCharAt(sig, 2, null, 8);
    expect(sig.node).toBeUndefined();
  });
});
