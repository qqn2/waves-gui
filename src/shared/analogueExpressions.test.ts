import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ANALOGUE_CONTEXT,
  evaluateAnalogueCurve,
  evaluateAnalogueScalar,
  evaluateUndulateSequence,
  validateUndulateSequence,
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

  it('evaluates bounded Undulate generated sequences with the loop index', () => {
    expect(evaluateUndulateSequence('[i/16 for i in range(16)]'))
      .toEqual(Array.from({ length: 16 }, (_, i) => i / 16));
    expect(evaluateUndulateSequence('[0.4*(i%4)+0.1 for i in range(16)]'))
      .toHaveLength(16);
    evaluateUndulateSequence('[0.4*(i%4)+0.1 for i in range(4)]')
      .forEach((value, index) => expect(value).toBeCloseTo([0.1, 0.5, 0.9, 1.3][index]!));
    expect(evaluateUndulateSequence('[VDDA/2 + VSSA + pi*i for i in range(0)]'))
      .toEqual([]);
  });

  it('rejects unbounded or non-whitelisted generated sequence syntax', () => {
    expect(validateUndulateSequence('[i for i in range(10001)]'))
      .toContain('generated sequence length');
    expect(validateUndulateSequence('[i for x in range(2)]'))
      .toContain('generated sequences must use');
    expect(validateUndulateSequence('[i if i else 0 for i in range(2)]'))
      .toContain('unexpected trailing input');
    expect(validateUndulateSequence('[i/0 for i in range(2)]'))
      .toContain('division by zero');
    expect(validateUndulateSequence('[rnd() for i in range(2)]'))
      .toContain('rnd() is not supported');
    expect(validateUndulateSequence('[import(i) for i in range(2)]'))
      .toContain('unsupported function');
  });
});
