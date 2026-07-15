import { describe, expect, it } from 'vitest';
import { clockArrowPoints, clockCycleEndY, clockCycleSvg } from './drawClock';

describe('clockArrowPoints', () => {
  it('places posedge arrow on the vertical midpoint pointing up', () => {
    const yHigh = 10;
    const yLow = 30;
    const { tipY, y1, y2 } = clockArrowPoints(true, 50, yHigh, yLow, 3, 5);
    const yMid = (yHigh + yLow) / 2;
    expect(tipY).toBeLessThan(yMid);
    expect(y1).toBeGreaterThan(yMid);
    expect(y2).toBeGreaterThan(yMid);
  });

  it('places negedge arrow on the vertical midpoint pointing down', () => {
    const yHigh = 10;
    const yLow = 30;
    const { tipY, y1, y2 } = clockArrowPoints(false, 50, yHigh, yLow, 3, 5);
    const yMid = (yHigh + yLow) / 2;
    expect(tipY).toBeGreaterThan(yMid);
    expect(y1).toBeLessThan(yMid);
    expect(y2).toBeLessThan(yMid);
  });
});

describe('clockCycleSvg', () => {
  it('draws both edges inside one positive clock column', () => {
    const svg = clockCycleSvg('P', 0, 40, 10, 30, '#48f').join('');
    expect(svg).toContain('M0,30 L0,10 L20,10 L20,30 L40,30');
    expect(svg).toContain('<polygon');
    expect(clockCycleEndY('P', 10, 30)).toBe(30);
  });

  it('draws both edges inside one negative clock column', () => {
    const svg = clockCycleSvg('N', 0, 40, 10, 30, '#48f').join('');
    expect(svg).toContain('M0,10 L0,30 L20,30 L20,10 L40,10');
    expect(clockCycleEndY('N', 10, 30)).toBe(10);
  });
});
