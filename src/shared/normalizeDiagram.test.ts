import { describe, expect, it } from 'vitest';
import { diagramToCodeString } from '../codePanel/codeSync';
import type { DiagramState } from './types';
import { normalizeDiagram } from './normalizeDiagram';

describe('normalizeDiagram', () => {
  it('adds edges[] when missing from legacy drafts', () => {
    const legacy = {
      version: 1,
      signals: [],
      config: { totalSteps: 8, hscale: 1 },
      annotations: [],
    } as unknown as DiagramState;

    const fixed = normalizeDiagram(legacy);
    expect(fixed.edges).toEqual([]);
  });

  it('allows CodePanel export after legacy draft shape', () => {
    const legacy = {
      version: 1,
      signals: [
        {
          id: 'v1',
          name: 'bus',
          type: 'vector',
          states: [],
          color: '#4a9eff',
          rowHeight: 40,
        },
      ],
      config: { totalSteps: 4, hscale: 1 },
      annotations: [],
    } as unknown as DiagramState;

    expect(() => diagramToCodeString(normalizeDiagram(legacy))).not.toThrow();
  });

  it('repairs groups without children', () => {
    const legacy = {
      version: 1,
      signals: [
        {
          id: 'g1',
          name: 'grp',
          type: 'group',
        },
      ],
      config: { totalSteps: 4, hscale: 1 },
      edges: [],
      annotations: [],
    } as unknown as DiagramState;

    const fixed = normalizeDiagram(legacy);
    const g = fixed.signals[0];
    expect(g?.type).toBe('group');
    if (g?.type === 'group') {
      expect(Array.isArray(g.children)).toBe(true);
    }
  });

  it('repairs vector signals without segments', () => {
    const legacy = {
      version: 1,
      signals: [
        {
          id: 'v1',
          name: 'bus',
          type: 'vector',
          states: [],
          color: '#4a9eff',
          rowHeight: 40,
        },
      ],
      config: { totalSteps: 4, hscale: 1 },
      annotations: [],
    } as unknown as DiagramState;

    const fixed = normalizeDiagram(legacy);
    const bus = fixed.signals[0];
    expect(bus?.type).toBe('vector');
    if (bus?.type === 'vector') {
      expect(bus.segments.length).toBeGreaterThan(0);
      expect(bus.segments[0]!.endStep).toBe(4);
    }
  });
});
