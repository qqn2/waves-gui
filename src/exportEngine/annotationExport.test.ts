// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { defaultView } from '../shared/store/helpers';
import { buildSVGString } from './exportSVG';

describe('annotation image export', () => {
  it('includes safely escaped text while extensions are visible', () => {
    const diagram = createDefaultDiagram();
    diagram.compatibility = {
      ...diagram.compatibility,
      extensionsEnabled: true,
    };
    const signal = diagram.signals.find((item) => item.type === 'bit');
    diagram.annotations = [
      {
        id: 'note-1',
        type: 'text',
        text: '<setup & hold>',
        tick: 1,
        signalId: signal?.id,
      },
    ];

    const svg = buildSVGString(diagram, defaultView());
    expect(svg).toContain('&lt;setup &amp; hold&gt;');
    expect(svg).not.toContain('<setup & hold>');
  });

  it('omits annotation text while extensions are hidden', () => {
    const diagram = createDefaultDiagram();
    diagram.annotations = [
      { id: 'note-1', type: 'text', text: 'hidden-note', tick: 0 },
    ];

    expect(buildSVGString(diagram, defaultView())).not.toContain('hidden-note');
  });

  it('exports vertical and horizontal annotation lines to SVG', () => {
    const diagram = createDefaultDiagram();
    diagram.compatibility = { extensionsEnabled: true };
    const signal = diagram.signals.find((item) => item.type === 'bit');
    diagram.annotations = [
      { id: 'v', type: 'vertical-line', tick: 1 },
      { id: 'h', type: 'horizontal-line', signalId: signal?.id },
    ];
    const svg = buildSVGString(diagram, defaultView());
    expect(svg.match(/stroke-dasharray="5 4"/g)).toHaveLength(2);
  });
});
