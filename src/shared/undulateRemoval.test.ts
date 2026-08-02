// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  fromUndulateJSON,
  validateUndulateJSON,
  type UndulateRoot,
} from '../undulateBridge';
import {
  toWavedromJSON,
  validateWavedromJSON,
} from '../wavedromBridge';
import {
  renderWavedromSvg,
  svgMetrics,
} from '../wavedromBridge/renderWavedromSvg';
import { scanExtensionContent } from './annotations';
import { DEFAULT_STEPS } from './constants';
import { useStore } from './store';
import type { DiagramState } from './types';

function emptyDiagram(): DiagramState {
  return {
    version: 2,
    compatibility: { extensionsEnabled: false },
    signals: [],
    config: { totalSteps: DEFAULT_STEPS, hscale: 1 },
    annotations: [],
    edges: [],
  };
}

describe('remove Undulate features for WaveDrom', () => {
  beforeEach(() => {
    useStore.getState().loadDiagram(emptyDiagram());
  });

  it('strips a feature-rich Undulate document and compiles it with WaveDrom', async () => {
    const root = {
      signal: [
        [
          'digital',
          {
            name: 'extended states',
            wave: 'X=23456789iImMhHlL',
            node: 'a#................ request.ready',
            stroke: '#336699',
            fill: 'rgba(51, 102, 153, 0.2)',
            'stroke-width': 2,
            'stroke-dasharray': [4, 2],
            'font-size': '14px',
            future_lane: { revision: 2 },
          },
          {
            name: 'timed clock',
            wave: 'p',
            repeat: 4,
            periods: [0.5, 1, 1.5, 2],
            duty_cycles: [0.25, 0.5, 0.75, 0.5],
            phase: -0.25,
            slewing: 0.1,
            node: '...b',
          },
        ],
        [
          'analogue',
          {
            name: 'rail A',
            wave: '0sca',
            analogue: [
              'VDDA * 0.5',
              1.2,
              [[0, 1.2], [1, 0.4]],
            ],
            slewing: 8,
            vscale: 2,
            overlay: true,
            order: 1,
            stroke: '#8844aa',
          },
          {
            name: 'rail B',
            wave: 's...',
            analogue: [0.75],
            order: 2,
          },
        ],
        {},
      ],
      edges: [
        'a->b shared edge',
        'request.ready -> b expanded endpoint',
        'a #-* b extended markers',
      ],
      annotations: [
        {
          text: 'text annotation',
          x: 1.25,
          y: 0.5,
          fill: '#112233',
          'font-size': '16px',
          text_background: true,
          future_annotation: { align: 'center' },
        },
        {
          shape: '|',
          x: 2.5,
          from: '10%',
          to: 3,
          stroke: '#445566',
          'stroke-width': 2,
          'stroke-dasharray': [3, 2],
        },
        { shape: '-', y: 1.5, from: 0, to: '100%' },
        { shape: '||', x: 3.5, from: 0, to: '100%' },
        {
          shape: '<~>',
          from: 'request.ready(1,-1)',
          to: ['75%', '50%'],
          text: 'structured arrow',
          dx: 2,
          dy: -1,
        },
      ],
      config: {
        hscale: 2,
        skin: 'lowkey',
        future_config: { grid: 4 },
      },
      head: {
        text: 'Complete Undulate document',
        tick: 0,
        every: 2,
        future_head: true,
      },
      foot: {
        text: 'WaveDrom-compatible subset',
        tock: 1,
        every: 2,
        future_foot: false,
      },
      future_root: {
        revision: 2,
        enabled: true,
      },
    } as unknown as UndulateRoot;

    expect(validateUndulateJSON(root)).toBeNull();
    useStore.getState().loadDiagram(fromUndulateJSON(root));

    useStore.getState().removeUndulateFeatures();

    const stripped = useStore.getState().diagram;
    const wavedrom = toWavedromJSON(stripped);
    const serialized = JSON.stringify(wavedrom);

    expect(scanExtensionContent(stripped).hasExtensions).toBe(false);
    expect(stripped.compatibility).toEqual({
      extensionsEnabled: false,
      sourceFormat: 'wavedrom-json',
    });
    expect(wavedrom.edge).toEqual(['a->b shared edge']);
    expect(serialized).not.toMatch(
      /"analogue"|"annotations"|"repeat"|"periods"|"duty_cycles"|"overlay"|"future_/,
    );
    expect(serialized).not.toMatch(/"wave":"[^"]*[iImMhHlL]/);
    expect(validateWavedromJSON(wavedrom)).toBeNull();

    const svg = await renderWavedromSvg(wavedrom);
    expect(svg).toContain('<svg');
    const metrics = svgMetrics(svg);
    expect(metrics.width).toBeGreaterThan(0);
    expect(metrics.height).toBeGreaterThan(0);
    expect(metrics.pathCount).toBeGreaterThan(0);
  });

  it('resamples native vector timing onto major columns before removal', () => {
    const diagram = fromUndulateJSON({
      signal: [{
        name: 'fine bus',
        wave: '=.=.=.=.',
        data: ['A', 'B', 'C', 'D'],
        period: 0.5,
      }],
    } as UndulateRoot);
    expect(diagram.config.totalSteps).toBe(4);
    useStore.getState().loadDiagram(diagram);
    useStore.getState().removeUndulateFeatures();

    const signal = useStore.getState().diagram.signals[0];
    if (!signal || signal.type !== 'vector') throw new Error('expected vector lane');
    expect(signal.vectorTiming).toBeUndefined();
    expect(signal.segments.every((segment) => segment.endStep <= 4)).toBe(true);
    expect(toWavedromJSON(useStore.getState().diagram).signal[0]).toMatchObject({
      wave: expect.any(String),
    });
    expect((toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string }).wave)
      .toHaveLength(4);
  });
});
