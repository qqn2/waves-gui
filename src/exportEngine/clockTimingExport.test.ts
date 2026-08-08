// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { useStore } from '../shared/store';
import type { Signal } from '../shared/types';
import { laneLogicalWidth } from '../renderer/laneTiming';
import { computeExportDimensions } from './exportDimensions';
import { buildSVGString } from './exportSVG';
import { fromUndulateJSON } from '../undulateBridge/undulateJSON';

describe('clock timing exports', () => {
  it('allocates enough width for a period-stretched, delayed lane', () => {
    const diagram = createDefaultDiagram();
    const clk = diagram.signals[0] as Signal;
    clk.period = 2;
    clk.phase = -0.5;

    const dims = computeExportDimensions(diagram, useStore.getState().view);
    expect(dims.waveformWidth).toBe(laneLogicalWidth(clk, diagram.config.totalSteps));
    expect(dims.waveformWidth).toBe(820);
  });

  it('uses lane period and phase in SVG clock geometry', () => {
    const diagram = createDefaultDiagram();
    const clk = diagram.signals[0] as Signal;
    clk.period = 2;
    clk.phase = -0.5;

    const svg = buildSVGString(diagram, useStore.getState().view);
    expect(svg).toContain('M20,');
    expect(svg).toContain('L60,');
    expect(svg).toContain('L100,');
  });

  it('exports collapsed imported timing cells without non-finite geometry', () => {
    const diagram = fromUndulateJSON({
      signal: [{
        name: 'adaptive',
        wave: 'ppp',
        periods: [0, 1, 2],
      }],
    });
    const signal = diagram.signals[0] as Signal;
    expect(signal.digitalTiming?.cells.map((cell) => cell.durationTicks))
      .toEqual([0, 1, 2]);
    const svg = buildSVGString(diagram, useStore.getState().view);
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
});
