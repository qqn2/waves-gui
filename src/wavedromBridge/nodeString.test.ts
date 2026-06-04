import { describe, expect, it } from 'vitest';
import type { DiagramState } from '../shared/types';
import {
  allocateNodeChar,
  formatArrowEdge,
  formatTimespanEdge,
  padNodeString,
  pruneUnusedNodeAnchorsAfterEdgeRemoval,
  setNodeCharAt,
  visibleNodeCharAt,
} from './nodeString';

function diagramWithNode(node: string): DiagramState {
  return {
    version: 1,
    config: { totalSteps: 8, hscale: 1 },
    edges: [],
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

  it('reads visible anchor letters at a step', () => {
    const d = diagramWithNode('..a.....');
    const sig = d.signals[0] as import('../shared/types').Signal;
    expect(visibleNodeCharAt(sig, 2, 8)).toBe('a');
    expect(visibleNodeCharAt(sig, 0, 8)).toBeNull();
  });

  it('prunes node anchors when their edge is removed', () => {
    const d = diagramWithNode('a...b...');
    d.edges = [];
    pruneUnusedNodeAnchorsAfterEdgeRemoval(d, 'a->b note');
    const sig = d.signals[0] as import('../shared/types').Signal;
    expect(sig.node).toBeUndefined();
  });

  it('keeps shared anchors referenced by another edge', () => {
    const d = diagramWithNode('a...b...');
    d.edges = ['a->c'];
    const sig = d.signals[0] as import('../shared/types').Signal;
    setNodeCharAt(sig, 6, 'c', 8);
    pruneUnusedNodeAnchorsAfterEdgeRemoval(d, 'a->b');
    expect(sig.node?.[0]).toBe('a');
    expect(sig.node?.[6]).toBe('c');
    expect(sig.node?.includes('b')).toBe(false);
  });
});
