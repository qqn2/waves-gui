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
        style: { fontSize: 18, textBackground: false },
      },
    ];

    const svg = buildSVGString(diagram, defaultView());
    expect(svg).toContain('&lt;setup &amp; hold&gt;');
    expect(svg).not.toContain('<setup & hold>');
    expect(svg).toContain('font-size="18"');
  });

  it('omits annotation text while extensions are hidden', () => {
    const diagram = createDefaultDiagram();
    diagram.annotations = [
      { id: 'note-1', type: 'text', text: 'hidden-note', tick: 0 },
    ];

    expect(buildSVGString(diagram, defaultView())).not.toContain('hidden-note');
  });

  it('exports styled lines and global compression to SVG', () => {
    const diagram = createDefaultDiagram();
    diagram.compatibility = { extensionsEnabled: true };
    const signal = diagram.signals.find((item) => item.type === 'bit');
    diagram.annotations = [
      {
        id: 'v',
        type: 'vertical-line',
        tick: 1,
        rangeFrom: { unit: 'percent', value: 25 },
        rangeTo: { unit: 'percent', value: 75 },
        style: { stroke: '#123456', strokeWidth: 2, strokeDasharray: [3, 2] },
      },
      {
        id: 'h',
        type: 'horizontal-line',
        signalId: signal?.id,
        rangeFrom: { unit: 'index', value: 1 },
        rangeTo: { unit: 'index', value: 3 },
      },
      { id: 'c', type: 'global-compression', tick: 2 },
    ];
    const svg = buildSVGString(diagram, defaultView());
    expect(svg).toContain('stroke="#123456" stroke-width="2" stroke-dasharray="3 2"');
    expect(svg.match(/stroke-dasharray="5 4"/g)).toHaveLength(1);
    expect(svg).toContain('width="12"');
    expect(svg).toContain('x1="40"');
    expect(svg).toContain('x2="120"');
  });
});
