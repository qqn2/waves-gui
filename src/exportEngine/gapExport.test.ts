// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { defaultView } from '../shared/store/helpers';
import type { Signal } from '../shared/types';
import { buildSVGString } from './exportSVG';

describe('gap image export', () => {
  it('renders WaveDrom gap symbols on bit and vector lanes', () => {
    const diagram = createDefaultDiagram();
    diagram.config.totalSteps = 3;
    const bit: Signal = {
      id: 'bit',
      name: 'wire',
      type: 'bit',
      states: ['0', '0', '1'],
      segments: [],
      stepGaps: [false, true, false],
      color: '#4A9EFF',
      rowHeight: 40,
    };
    const vector: Signal = {
      id: 'vector',
      name: 'bus',
      type: 'vector',
      states: [],
      segments: [{
        id: 'segment',
        startStep: 0,
        endStep: 3,
        value: 'data',
      }],
      stepGaps: [false, true, false],
      color: '#4A9EFF',
      rowHeight: 40,
    };
    diagram.signals = [bit, vector];

    const svg = buildSVGString(diagram, defaultView());

    expect(svg.match(/M-3.5,-2/g)).toHaveLength(2);
    expect(svg.match(/M-7,22/g)).toHaveLength(2);
    expect(svg.match(/M-6,22/g)).toHaveLength(2);
    // A `|` column keeps the held trace beneath the narrow overlay.
    expect(svg).toContain('M0,80 L40,80 L80,80');
  });
});
