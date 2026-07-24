// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { measureHeadFoot } from '../renderer/renderHeadFoot';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { defaultView } from '../shared/store/helpers';
import { computeExportDimensions } from './exportDimensions';
import { buildSVGString } from './exportSVG';

describe('head/foot image export', () => {
  it('reserves the same head and foot bands for SVG, PNG, and JPEG dimensions', () => {
    const diagram = createDefaultDiagram();
    delete diagram.config.head;
    delete diagram.config.foot;
    const base = computeExportDimensions(diagram, defaultView());
    diagram.config.head = { text: 'Transaction', tick: 2, every: 2 };
    diagram.config.foot = { text: 'cycles', tock: 3, every: 2 };

    const { headHeight, footHeight } = measureHeadFoot(diagram.config);
    const dimensions = computeExportDimensions(diagram, defaultView());

    expect(dimensions.axisOffset).toBe(base.axisOffset + headHeight);
    expect(dimensions.totalHeight).toBe(
      base.totalHeight + headHeight + footHeight,
    );
  });

  it('includes escaped captions and tick/tock labels in SVG output', () => {
    const diagram = createDefaultDiagram();
    diagram.config.totalSteps = 4;
    diagram.config.head = { text: '<Transaction>', tick: 2, every: 2 };
    diagram.config.foot = { text: 'cycles & time', tock: 3, every: 2 };

    const svg = buildSVGString(diagram, defaultView());

    expect(svg).toContain('&lt;Transaction&gt;');
    expect(svg).toContain('cycles &amp; time');
    expect(svg).toMatch(/>2<\/text>/);
    expect(svg).toMatch(/>3<\/text>/);
  });
});
