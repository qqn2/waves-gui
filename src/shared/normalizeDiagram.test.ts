import { describe, expect, it } from 'vitest';
import { diagramToCodeString } from '../codePanel/codeSync';
import type { DiagramState } from './types';
import { normalizeDiagram } from './normalizeDiagram';

describe('normalizeDiagram', () => {
  it('migrates version 1 diagrams with extensions disabled', () => {
    const migrated = normalizeDiagram({
      version: 1,
      signals: [],
      config: { totalSteps: 8, hscale: 1 },
      edges: [],
    });

    expect(migrated.version).toBe(2);
    expect(migrated.compatibility).toEqual({ extensionsEnabled: false });
  });

  it('preserves version 2 compatibility metadata', () => {
    const normalized = normalizeDiagram({
      version: 2,
      compatibility: {
        extensionsEnabled: true,
        sourceFormat: 'undulate-json',
        sourceRevision: '2024.1',
      },
      signals: [],
      config: { totalSteps: 8, hscale: 1 },
      edges: [],
    });

    expect(normalized.compatibility).toEqual({
      extensionsEnabled: true,
      sourceFormat: 'undulate-json',
      sourceRevision: '2024.1',
    });
  });

  it('preserves fractional hscale within 1–4', () => {
    const d = normalizeDiagram({
      version: 1,
      signals: [],
      config: { totalSteps: 8, hscale: 1.5 },
      edges: [],
    });
    expect(d.config.hscale).toBe(1.5);
  });

  it('adds edges[] when missing from legacy drafts', () => {
    const legacy = {
      version: 1,
      signals: [],
      config: { totalSteps: 8, hscale: 1 },
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
    } as unknown as DiagramState;

    const fixed = normalizeDiagram(legacy);
    const bus = fixed.signals[0];
    expect(bus?.type).toBe('vector');
    if (bus?.type === 'vector') {
      expect(bus.segments.length).toBeGreaterThan(0);
      expect(bus.segments[0]!.endStep).toBe(4);
    }
  });

  it('keeps native timed bit states authoritative over the compatibility cache', () => {
    const normalized = normalizeDiagram({
      version: 2,
      signals: [{
        id: 'timed',
        name: 'timed',
        type: 'bit',
        states: ['0', '0'],
        segments: [],
        color: '#4a9eff',
        rowHeight: 40,
        digitalTiming: {
          ticksPerStep: 1,
          phaseTicks: 0,
          cells: [
            { state: '1', durationTicks: 1 },
            { state: 'x', durationTicks: 1 },
          ],
        },
      }],
      config: { totalSteps: 2, hscale: 1 },
      edges: [],
    });

    const signal = normalized.signals[0];
    expect(signal?.type).toBe('bit');
    if (signal?.type === 'bit') {
      expect(signal.states).toEqual(['1', 'x']);
      expect(signal.digitalTiming?.cells.map((cell) => cell.state)).toEqual(['1', 'x']);
    }
  });

  it('fits native vector gap flags to the timing-cell track', () => {
    const normalized = normalizeDiagram({
      version: 2,
      signals: [{
        id: 'timed-bus',
        name: 'timed-bus',
        type: 'vector',
        states: [],
        segments: [{ id: 'seg', startStep: 0, endStep: 6, value: 'A' }],
        stepGaps: [false, false, false, false, true, false, true, true],
        color: '#4a9eff',
        rowHeight: 40,
        vectorTiming: {
          ticksPerStep: 2,
          phaseTicks: 0,
          cells: Array.from({ length: 6 }, () => ({ durationTicks: 1 })),
        },
      }],
      config: { totalSteps: 3, hscale: 1 },
      edges: [],
    });
    const signal = normalized.signals[0];
    expect(signal?.type).toBe('vector');
    if (signal?.type !== 'vector') return;
    expect(signal.stepGaps).toEqual([false, false, false, false, true, false]);
  });
});
