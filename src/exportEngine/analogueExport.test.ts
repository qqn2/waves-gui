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
      rowHeight: 40,
      analogueMin: 0,
      analogueMax: 1.8,
      analogueCells: [
        { id: 'one', kind: 'step', value: 0.9 },
        { id: 'two', kind: 'capacitive', value: 1.8 },
      ],
    }];

    const svg = buildSVGString(diagram, defaultView());
    expect(svg).toContain('stroke="#12ab34"');
    expect(svg).toContain('<path d="M 0');
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
