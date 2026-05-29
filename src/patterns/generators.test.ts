import { describe, it, expect } from 'vitest';
import type { VectorSegment } from '../shared/types';
import {
  clockPattern,
  counterPattern,
  resetPattern,
  pulsePattern,
  strobePattern,
  pwmPattern,
  walkingOnePattern,
  walkingZeroPattern,
  busIdlePattern,
  alternatingPattern,
  grayCodePattern,
} from './generators';

function expectBitLength(states: { length: number }, totalSteps: number): void {
  expect(states).toHaveLength(totalSteps);
}

function expectSegmentCoverage(segments: VectorSegment[], totalSteps: number): void {
  expect(segments.length).toBeGreaterThan(0);
  expect(segments[0]!.startStep).toBe(0);
  expect(segments[segments.length - 1]!.endStep).toBe(totalSteps);
  for (let i = 1; i < segments.length; i++) {
    expect(segments[i]!.startStep).toBe(segments[i - 1]!.endStep);
  }
}

describe('pattern generators — length', () => {
  const totalSteps = 12;

  it('bit patterns match totalSteps', () => {
    expectBitLength(clockPattern({ totalSteps }), totalSteps);
    expectBitLength(resetPattern({ totalSteps }), totalSteps);
    expectBitLength(pulsePattern({ totalSteps }), totalSteps);
    expectBitLength(strobePattern({ totalSteps }), totalSteps);
    expectBitLength(pwmPattern({ totalSteps }), totalSteps);
    expectBitLength(walkingOnePattern({ totalSteps }), totalSteps);
    expectBitLength(walkingZeroPattern({ totalSteps }), totalSteps);
    expectBitLength(alternatingPattern({ totalSteps }), totalSteps);
  });

  it('vector patterns cover 0..totalSteps', () => {
    for (const segments of [
      counterPattern({ totalSteps }),
      busIdlePattern({ totalSteps }),
      grayCodePattern({ totalSteps }),
    ]) {
      expectSegmentCoverage(segments, totalSteps);
    }
  });
});

describe('clockPattern', () => {
  it('alternates 1,0 with default period', () => {
    const states = clockPattern({ totalSteps: 6 });
    expect(states).toEqual(['1', '0', '1', '0', '1', '0']);
  });

  it('respects period and phase', () => {
    const states = clockPattern({ totalSteps: 8, period: 4, phase: 0.5 });
    expect(states.slice(0, 4)).toEqual(['0', '0', '1', '1']);
  });

  it('inverts when initialValue is 0', () => {
    const states = clockPattern({ totalSteps: 4, initialValue: '0' });
    expect(states).toEqual(['0', '1', '0', '1']);
  });
});

describe('resetPattern', () => {
  it('asserts for the first N steps', () => {
    const states = resetPattern({ totalSteps: 8, assertedSteps: 3 });
    expect(states.slice(0, 3)).toEqual(['1', '1', '1']);
    expect(states.slice(3)).toEqual(['0', '0', '0', '0', '0']);
  });

  it('supports active-low reset', () => {
    const states = resetPattern({
      totalSteps: 5,
      assertedSteps: 2,
      activeHigh: false,
    });
    expect(states).toEqual(['0', '0', '1', '1', '1']);
  });
});

describe('pulsePattern', () => {
  it('is high only between start and end (inclusive)', () => {
    const states = pulsePattern({
      totalSteps: 8,
      startStep: 2,
      endStep: 4,
    });
    expect(states).toEqual(['0', '0', '1', '1', '1', '0', '0', '0']);
  });
});

describe('strobePattern', () => {
  it('repeats a pulse every period', () => {
    const states = strobePattern({ totalSteps: 8, period: 4, width: 1 });
    expect(states).toEqual(['1', '0', '0', '0', '1', '0', '0', '0']);
  });
});

describe('pwmPattern', () => {
  it('honors duty cycle within each period', () => {
    const states = pwmPattern({ totalSteps: 8, period: 4, dutyCycle: 0.5 });
    expect(states).toEqual(['1', '1', '0', '0', '1', '1', '0', '0']);
  });
});

describe('alternatingPattern', () => {
  it('starts low when startHigh is false', () => {
    expect(alternatingPattern({ totalSteps: 4, startHigh: false })).toEqual([
      '0',
      '1',
      '0',
      '1',
    ]);
  });
});

describe('walking patterns', () => {
  it('walking one shifts the high step each block', () => {
    const states = walkingOnePattern({ totalSteps: 8, bits: 4 });
    expect(states).toEqual(['1', '0', '0', '0', '0', '1', '0', '0']);
  });

  it('walking zero is inverted', () => {
    const one = walkingOnePattern({ totalSteps: 4, bits: 2 });
    const zero = walkingZeroPattern({ totalSteps: 4, bits: 2 });
    expect(zero).toEqual(one.map((s) => (s === '1' ? '0' : '1')));
  });
});

describe('counterPattern', () => {
  it('formats hex labels', () => {
    const segments = counterPattern({ totalSteps: 20, bits: 4, format: 'hex' });
    expect(segments[0]!.value).toBe('0');
    expect(segments[15]!.value).toBe('F');
  });

  it('formats decimal labels', () => {
    const segments = counterPattern({ totalSteps: 12, bits: 4, format: 'dec' });
    expect(segments[9]!.value).toBe('9');
  });
});

describe('busIdlePattern', () => {
  it('uses the idle label for the full span', () => {
    const segments = busIdlePattern({ totalSteps: 10, idleLabel: 'ZZ' });
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      startStep: 0,
      endStep: 10,
      value: 'ZZ',
    });
  });
});

describe('grayCodePattern', () => {
  it('produces adjacent gray codes in binary format', () => {
    const segments = grayCodePattern({ totalSteps: 4, bits: 2, format: 'gray' });
    const labels = segments.map((s) => s.value);
    expect(labels).toEqual(['00', '01', '11', '10']);
  });
});
