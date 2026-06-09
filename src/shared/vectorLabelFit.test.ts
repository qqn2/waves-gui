import { describe, it, expect } from 'vitest';

import type { Signal, VectorSegment } from './types';

import {

  labelOverflowsInWidth,

  labelOverflowSlackPx,

  minHscaleForSegmentLabel,

  minStepsForBusLabel,

  segmentLabelFit,

  segmentUsableLabelPx,

} from './vectorLabelFit';



const vectorSignal = (segments: VectorSegment[]): Signal => ({

  id: 'v1',

  name: 'data',

  type: 'vector',

  states: [],

  segments,

  color: '#4A9EFF',

  rowHeight: 40,

});



describe('vectorLabelFit', () => {

  it('reports overflow for a long label in a narrow span', () => {

    const segment: VectorSegment = {

      id: 's1',

      startStep: 0,

      endStep: 1,

      value: '0xDEADBEEF',

    };

    const fit = segmentLabelFit(segment, vectorSignal([segment]), 1);

    expect(fit.fits).toBe(false);

    expect(fit.minHscale).toBeGreaterThan(1);

  });



  it('computes minSteps from label width and hscale', () => {

    const signal = vectorSignal([]);

    const oneStep = minStepsForBusLabel('AB', signal, 1);

    const twoStep = minStepsForBusLabel('AB', signal, 2);

    expect(twoStep).toBeLessThanOrEqual(oneStep);

  });



  it('segmentUsableLabelPx subtracts bus diagonal padding', () => {

    expect(segmentUsableLabelPx(100, 1)).toBeLessThan(100);

  });



  it('allows roughly two characters of slack before overflow', () => {

    const fontPx = 14;

    const slack = labelOverflowSlackPx(fontPx);

    const width = 50;

    expect(labelOverflowsInWidth('A', width + slack - 1, fontPx, false)).toBe(false);

    expect(labelOverflowsInWidth('0xDEADBEEF', 40, fontPx, false)).toBe(true);

    expect(labelOverflowsInWidth('data', 10, fontPx, true)).toBe(true);

  });



  it('minHscaleForSegmentLabel returns current scale when label already fits', () => {

    const segment: VectorSegment = {

      id: 's1',

      startStep: 0,

      endStep: 4,

      value: 'AB',

    };

    expect(minHscaleForSegmentLabel(segment, vectorSignal([segment]), 40)).toBe(1);

  });

});
