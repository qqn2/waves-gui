import { describe, expect, it } from 'vitest';
import type { DiagramState, ViewState } from '../shared/types';
import { svgEdges } from './exportEdges';

describe('Undulate edge marker export', () => {
  it('emits square and circle endpoint geometry', () => {
    const diagram: DiagramState = {
      version: 2,
      compatibility: { extensionsEnabled: true },
      config: { totalSteps: 2, hscale: 1 },
      annotations: [],
      signals: [
        {
          id: 'source',
          name: 'source',
          type: 'bit',
          states: ['0', '1'],
          segments: [],
          color: '#4A9EFF',
          rowHeight: 40,
          node: 'a.',
        },
        {
          id: 'target',
          name: 'target',
          type: 'bit',
          states: ['1', '0'],
          segments: [],
          color: '#4A9EFF',
          rowHeight: 40,
          node: '.b',
        },
      ],
      edges: ['a #-* b marked'],
    };
    const svg = svgEdges(
      diagram,
      { zoom: 1, scrollX: 0, scrollY: 0 } as ViewState,
      0,
    );
    expect(svg).toContain('<rect');
    expect(svg).toContain('<circle');
    expect(svg).toContain('marked');
  });
});
