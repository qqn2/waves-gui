import type { BitState, DigitalTiming, Signal } from './types';

export const MAX_TICKS_PER_STEP = 1024;
const EPSILON = 1e-9;

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return Math.abs(a);
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

export function fractionDenominator(value: number): number {
  if (!Number.isFinite(value)) return 1;
  for (let denominator = 1; denominator <= MAX_TICKS_PER_STEP; denominator++) {
    if (Math.abs(value * denominator - Math.round(value * denominator)) < EPSILON) {
      return denominator;
    }
  }
  return MAX_TICKS_PER_STEP;
}

export function timingResolution(values: number[]): number {
  let resolution = 1;
  for (const value of values) {
    const next = lcm(resolution, fractionDenominator(value));
    if (next > MAX_TICKS_PER_STEP) return MAX_TICKS_PER_STEP;
    resolution = next;
  }
  return resolution;
}

export function ticksFor(value: number, ticksPerStep: number): number {
  return Math.round(value * ticksPerStep);
}

export function timingForStates(
  states: BitState[],
  ticksPerStep: number,
  options: {
    phase?: number;
    period?: number;
    periods?: number[];
    dutyCycle?: number;
    dutyCycles?: number[];
    slewing?: number;
  },
): DigitalTiming {
  const cells = states.map((state, index) => {
    const duration = options.periods?.[index] ?? options.period ?? 1;
    const duty = options.dutyCycles?.[index] ?? options.dutyCycle;
    const durationTicks = Math.max(1, ticksFor(duration, ticksPerStep));
    return {
      state,
      durationTicks,
      ...(duty !== undefined
        ? {
            dutyTicks: Math.max(
              0,
              Math.min(durationTicks, ticksFor(duration * duty, ticksPerStep)),
            ),
          }
        : {}),
    };
  });
  return {
    ticksPerStep,
    phaseTicks: ticksFor(options.phase ?? 0, ticksPerStep),
    cells,
    ...(options.slewing !== undefined ? { slewing: options.slewing } : {}),
  };
}

export function signalTicksPerStep(signal: Signal, documentTicks = 1): number {
  return signal.digitalTiming ? Math.max(1, documentTicks) : 1;
}
