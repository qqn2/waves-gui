import { describe, expect, it } from 'vitest';
import { buildStepLabels, measureHeadFoot } from './renderHeadFoot';

describe('measureHeadFoot', () => {
  it('returns zero when head and foot are absent', () => {
    expect(measureHeadFoot({ totalSteps: 10, hscale: 1 })).toEqual({
      headHeight: 0,
      footHeight: 0,
    });
  });

  it('reserves space for head text and tick band', () => {
    const m = measureHeadFoot({
      totalSteps: 10,
      hscale: 1,
      head: { text: 'Title', tick: 0 },
    });
    expect(m.headHeight).toBeGreaterThan(0);
    expect(m.footHeight).toBe(0);
  });

  it('reserves space for foot text and tock band', () => {
    const m = measureHeadFoot({
      totalSteps: 10,
      hscale: 1,
      foot: { text: 'Fig 1', tock: 1, every: 2 },
    });
    expect(m.headHeight).toBe(0);
    expect(m.footHeight).toBeGreaterThan(0);
  });
});

describe('buildStepLabels', () => {
  it('numbers steps from tick offset', () => {
    expect(buildStepLabels(0, undefined, 4)).toEqual(['0', '1', '2', '3']);
    expect(buildStepLabels(5, undefined, 3)).toEqual(['5', '6', '7']);
  });

  it('filters labels with every', () => {
    expect(buildStepLabels(0, 2, 5)).toEqual(['0', '', '2', '', '4']);
  });
});
