import { describe, expect, it } from 'vitest';
import type { DiagramState } from '../shared/types';
import {
  layoutLineAnnotations,
  layoutTextAnnotations,
} from './annotationLayout';

const diagram: DiagramState = {
  version: 2,
  compatibility: { extensionsEnabled: true },
  signals: [],
  config: { totalSteps: 8, hscale: 1 },
  edges: [],
  annotations: [
    {
      id: 'anchored',
      type: 'text',
      text: 'Setup',
      tick: 2,
      signalId: 'sig-1',
      yOffset: -5,
    },
    {
      id: 'global',
      type: 'text',
      text: 'Start',
      tick: 0,
      yOffset: 12,
    },
    { id: 'vline', type: 'vertical-line', tick: 3 },
    {
      id: 'hline',
      type: 'horizontal-line',
      signalId: 'sig-1',
      yOffset: 4,
    },
  ],
};

describe('layoutTextAnnotations', () => {
  it('positions text by tick and semantic row anchor', () => {
    const layouts = layoutTextAnnotations(diagram, [
      { id: 'sig-1', type: 'bit', y: 40, height: 40 },
    ]);
    expect(layouts.map(({ annotation, x, y }) => ({
      id: annotation.id,
      x,
      y,
    }))).toEqual([
      { id: 'anchored', x: 100, y: 55 },
      { id: 'global', x: 20, y: 12 },
    ]);
  });

  it('hides all annotations with extensions disabled', () => {
    expect(
      layoutTextAnnotations(
        {
          ...diagram,
          compatibility: { extensionsEnabled: false },
        },
        [],
      ),
    ).toEqual([]);
  });

  it('positions vertical and horizontal lines on the shared logical grid', () => {
    const layouts = layoutLineAnnotations(diagram, [
      { id: 'sig-1', type: 'bit', y: 40, height: 40 },
    ]);
    expect(layouts).toEqual([
      expect.objectContaining({
        orientation: 'vertical',
        position: 140,
      }),
      expect.objectContaining({
        orientation: 'horizontal',
        position: 64,
      }),
    ]);
  });

  it('does not guess a position for a missing semantic row', () => {
    expect(layoutTextAnnotations(diagram, [])).toHaveLength(1);
    expect(layoutTextAnnotations(diagram, [])[0]?.annotation.id).toBe('global');
  });
});
