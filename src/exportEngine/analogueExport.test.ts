// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { defaultView } from '../shared/store/helpers';
import { buildSVGString } from './exportSVG';

describe('analogue image export', () => {
  it('includes the shared analogue curve path while extensions are visible', () => {
    const diagram = createDefaultDiagram();
    diagram.compatibility = { extensionsEnabled: true };
    diagram.config.totalSteps = 2;
    diagram.signals = [{
      id: 'ana',
      name: 'vin',
      type: 'analogue',
      states: [],
      segments: [],
      color: '#12ab34',
      style: {
        stroke: '#336699',
        strokeWidth: 3,
        strokeDasharray: [5, 2],
        fontFamily: 'monospace',
        fontWeight: 700,
      },
      rowHeight: 40,
      analogueMin: 0,
      analogueMax: 1.8,
      analogueCells: [
        { id: 'one', kind: 'step', value: 0.9 },
        { id: 'two', kind: 'capacitive', value: 1.8 },
      ],
    }];

    const svg = buildSVGString(diagram, defaultView());
    expect(svg).toContain(
      'stroke="#336699" stroke-width="3" stroke-dasharray="5 2"',
    );
    expect(svg).toContain(
      'font-family="monospace" font-weight="700" font-size="12"',
    );
    expect(svg).toContain('<path d="M 0');
  });

  it('exports mixed analogue metastability and impulse geometry', () => {
    const diagram = createDefaultDiagram();
    diagram.compatibility = { extensionsEnabled: true };
    diagram.config.totalSteps = 4;
    diagram.signals = [{
      id: 'mixed',
      name: 'mixed analogue',
      type: 'analogue',
      states: [],
      segments: [],
      color: '#12ab34',
      rowHeight: 40,
      analogueMin: 0,
      analogueMax: 1.8,
      analogueCells: [
        { id: 'm', kind: 'metastable-low', value: 0 },
        { id: 'M', kind: 'metastable-high', value: 1.8 },
        { id: 'i', kind: 'impulse-low', value: 1.8 },
        { id: 'I', kind: 'impulse-high', value: 0 },
      ],
    }];

    const svg = buildSVGString(diagram, defaultView());
    expect(svg).toContain('stroke="#12ab34"');
    expect(svg).toContain('M 0');
    expect(svg).toContain('L 100 80 L 100 56');
    expect(svg).toContain('L 140 80 L 140 56');
  });

  it('hides analogue curve paths with extension mode disabled', () => {
    const diagram = createDefaultDiagram();
    diagram.signals = [{
      id: 'ana',
      name: 'vin',
      type: 'analogue',
      states: [],
      segments: [],
      color: '#12ab34',
      rowHeight: 40,
      analogueCells: [{ id: 'one', kind: 'step', value: 1 }],
    }];

    expect(buildSVGString(diagram, defaultView())).not.toContain(
      'stroke="#12ab34"',
    );
  });
});
