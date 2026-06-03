import { describe, expect, it } from 'vitest';
import { clockArrowPoints } from './drawClock';

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
