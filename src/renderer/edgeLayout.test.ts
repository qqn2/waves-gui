import { describe, expect, it } from 'vitest';
import type { DiagramState } from '../shared/types';
import {
  buildEdgePathD,
  buildNodeIndex,
  hitTestDiagramEdge,
  parseEdge,
  parseEdgePath,
  parseEdgeString,
  resolveEdgeAnchors,
} from './edgeLayout';

function minimalDiagram(overrides: Partial<DiagramState> = {}): DiagramState {
  return {
    version: 1,
    signals: [],
    config: { totalSteps: 20, hscale: 1 },
    edges: [],
    annotations: [],
    ...overrides,
  };
}

describe('parseEdgeString', () => {
  it('splits path word and label', () => {
    expect(parseEdgeString('a~b t1')).toEqual({ path: 'a~b', label: 't1' });
    expect(parseEdge('a~b t1')).toEqual({
      fromNode: 'a',
      toNode: 'b',
      hasArrow: false,
      shape: '~',
      label: 't1',
    });
  });

  it('detects arrow before to node', () => {
    expect(parseEdgePath('c-~>d')).toEqual({
      fromNode: 'c',
      toNode: 'd',
      hasArrow: true,
      shape: '-~',
    });
    expect(parseEdgePath('h~->j')).toMatchObject({
      fromNode: 'h',
      toNode: 'j',
      hasArrow: true,
      shape: '~-',
    });
  });
});

describe('buildNodeIndex', () => {
  it('maps first occurrence per letter', () => {
    const diagram = minimalDiagram({
      signals: [
        {
          id: 'a',
          name: 'A',
          type: 'bit',
          states: Array(10).fill('0'),
          segments: [],
          color: '#4af',
          rowHeight: 40,
          node: '.a........',
        },
        {
          id: 'b',
          name: 'B',
          type: 'bit',
          states: Array(10).fill('0'),
          segments: [],
          color: '#4af',
          rowHeight: 40,
          node: '..b.......',
        },
      ],
    });
    const idx = buildNodeIndex(diagram.signals);
    expect(idx.get('a')).toMatchObject({ signalId: 'a', step: 1, char: 'a' });
    expect(idx.get('b')).toMatchObject({ signalId: 'b', step: 2, char: 'b' });
  });
});

describe('resolveEdgeAnchors', () => {
  it('returns canvas anchors for known nodes', () => {
    const diagram = minimalDiagram({
      config: { totalSteps: 8, hscale: 1 },
      signals: [
        {
          id: 's0',
          name: 'A',
          type: 'bit',
          states: Array(8).fill('0'),
          segments: [],
          color: '#4af',
          rowHeight: 40,
          node: 'a.......',
        },
        {
          id: 's1',
          name: 'B',
          type: 'bit',
          states: Array(8).fill('0'),
          segments: [],
          color: '#4af',
          rowHeight: 40,
          node: '....b...',
        },
      ],
    });
    const parsed = parseEdge('a->b')!;
    const idx = buildNodeIndex(diagram.signals);
    const view = {
      zoom: 1,
      scrollX: 0,
      scrollY: 0,
      showTimeAxis: false,
    } as import('../shared/types').ViewState;
    const anchors = resolveEdgeAnchors(diagram, view, parsed, idx);
    expect(anchors).not.toBeNull();
    expect(anchors!.to.y).toBeGreaterThan(anchors!.from.y);
  });
});

describe('hitTestDiagramEdge', () => {
  it('returns index when pointer is on the edge path', () => {
    const diagram = minimalDiagram({
      config: { totalSteps: 8, hscale: 1 },
      edges: ['a->b'],
      signals: [
        {
          id: 's0',
          name: 'A',
          type: 'bit',
          states: Array(8).fill('0'),
          segments: [],
          color: '#4af',
          rowHeight: 40,
          node: 'a.......',
        },
        {
          id: 's1',
          name: 'B',
          type: 'bit',
          states: Array(8).fill('0'),
          segments: [],
          color: '#4af',
          rowHeight: 40,
          node: '....b...',
        },
      ],
    });
    const parsed = parseEdge('a->b')!;
    const idx = buildNodeIndex(diagram.signals);
    const view = {
      zoom: 1,
      scrollX: 0,
      scrollY: 0,
      showTimeAxis: false,
    } as import('../shared/types').ViewState;
    const anchors = resolveEdgeAnchors(diagram, view, parsed, idx)!;
    const mx = (anchors.from.x + anchors.to.x) / 2;
    const my = (anchors.from.y + anchors.to.y) / 2;
    expect(hitTestDiagramEdge(mx, my, diagram, view)).toBe(0);
    expect(hitTestDiagramEdge(mx, my + 50, diagram, view)).toBeNull();
  });
});

describe('buildEdgePathD', () => {
  it('emits WaveDrom-style cubic curve for ~', () => {
    const d = buildEdgePathD({ x: 0, y: 0 }, { x: 100, y: 50 }, '~');
    expect(d).toMatch(/^M 0 0 C /);
  });

  it('emits Manhattan path for -|>', () => {
    const d = buildEdgePathD({ x: 10, y: 20 }, { x: 110, y: 80 }, '-|>');
    expect(d).toBe('M 10 20 l 100 0 0 60');
  });
});
