import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ANALOGUE_CONTEXT,
  evaluateAnalogueCurve,
  evaluateAnalogueScalar,
  validateAnalogueExpression,
} from './analogueExpressions';

describe('Ludwig analogue expressions', () => {
  it('evaluates the documented scalar context and math functions', () => {
    expect(evaluateAnalogueScalar(
      '0.5*VDDA + VSSA',
      DEFAULT_ANALOGUE_CONTEXT,
    )).toBeCloseTo(0.9);
    expect(evaluateAnalogueScalar(
      'sin(pi/2) + atan2(1, 0)',
      DEFAULT_ANALOGUE_CONTEXT,
    )).toBeCloseTo(1 + Math.PI / 2);
  });

  it('samples the documented time comprehension deterministically', () => {
    const source =
      '[(t, (VDDA+VSSA)*(1 + sin(2*pi*t*3.5/Tmax))/2) for t in time]';
    const points = evaluateAnalogueCurve(source, DEFAULT_ANALOGUE_CONTEXT);
    expect(points).toHaveLength(65);
    expect(points[0]).toEqual([0, 0.9]);
    expect(points.at(-1)?.[0]).toBe(1);
    expect(points.every(([offset, value]) =>
      Number.isFinite(offset) && Number.isFinite(value))).toBe(true);
  });

  it('rejects JavaScript access, assignments, and unknown functions', () => {
    expect(validateAnalogueExpression('globalThis.process', 'scalar'))
      .toContain('unsupported character');
    expect(validateAnalogueExpression('VDDA = 10', 'scalar'))
      .toContain('unsupported character');
    expect(validateAnalogueExpression('fetch(VDDA)', 'scalar'))
      .toContain('unsupported function');
  });
});
