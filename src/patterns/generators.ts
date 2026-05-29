import { nanoid } from 'nanoid';
import type { BitState, VectorSegment } from '../shared/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function clampBits(bits: number): number {
  return Math.min(16, Math.max(2, bits));
}

function formatValue(
  value: number,
  bits: number,
  format: 'hex' | 'dec' | 'bin' | 'gray',
): string {
  const mask = (1 << bits) - 1;
  const v = value & mask;
  switch (format) {
    case 'hex':
      return v.toString(16).toUpperCase();
    case 'bin':
      return v.toString(2).padStart(bits, '0');
    case 'gray':
      return (v ^ (v >> 1)).toString(2).padStart(bits, '0');
    case 'dec':
    default:
      return String(v);
  }
}

function grayCode(n: number): number {
  return n ^ (n >> 1);
}

/** Merge consecutive steps with the same label into non-overlapping segments. */
function stepsToSegments(
  totalSteps: number,
  labelAt: (step: number) => string,
): VectorSegment[] {
  if (totalSteps <= 0) return [];

  const segments: VectorSegment[] = [];
  let start = 0;
  let current = labelAt(0);

  for (let step = 1; step <= totalSteps; step++) {
    const next = step < totalSteps ? labelAt(step) : null;
    if (step === totalSteps || next !== current) {
      segments.push({
        id: nanoid(),
        startStep: start,
        endStep: step,
        value: current,
      });
      if (step < totalSteps) {
        start = step;
        current = next!;
      }
    }
  }

  return segments;
}

// ── Bit patterns ──────────────────────────────────────────────────────────────

/** Rising-edge clock: 1,0,1,0,... with optional period, phase, and initial level. */
export function clockPattern(opts: {
  totalSteps: number;
  period?: number;
  phase?: number;
  initialValue?: '0' | '1';
}): BitState[] {
  const { totalSteps, period = 2, phase = 0, initialValue = '1' } = opts;
  const cycle = Math.max(1, period);
  const phaseShift = Math.round(phase * cycle) % cycle;
  const highDuration = Math.max(1, Math.floor(cycle / 2));

  const states: BitState[] = [];
  for (let i = 0; i < totalSteps; i++) {
    const pos = (i + phaseShift) % cycle;
    const high = pos < highDuration;
    states.push(high ? '1' : '0');
  }

  if (initialValue === '0') {
    return states.map((s) => (s === '1' ? '0' : '1'));
  }
  return states;
}

/** Synchronous reset: asserted for the first N steps, then deasserted. */
export function resetPattern(opts: {
  totalSteps: number;
  assertedSteps?: number;
  activeHigh?: boolean;
}): BitState[] {
  const { totalSteps, assertedSteps = 2, activeHigh = true } = opts;
  const assertLen = Math.min(Math.max(0, assertedSteps), totalSteps);
  const asserted: BitState = activeHigh ? '1' : '0';
  const deasserted: BitState = activeHigh ? '0' : '1';

  return Array.from({ length: totalSteps }, (_, i) =>
    i < assertLen ? asserted : deasserted,
  );
}

/** Single pulse between startStep and endStep (inclusive). */
export function pulsePattern(opts: {
  totalSteps: number;
  startStep?: number;
  endStep?: number;
  activeHigh?: boolean;
}): BitState[] {
  const { totalSteps, startStep = 2, endStep = 4, activeHigh = true } = opts;
  const lo = Math.max(0, Math.min(startStep, endStep));
  const hi = Math.min(totalSteps - 1, Math.max(startStep, endStep));
  const active: BitState = activeHigh ? '1' : '0';
  const idle: BitState = activeHigh ? '0' : '1';

  return Array.from({ length: totalSteps }, (_, i) =>
    i >= lo && i <= hi ? active : idle,
  );
}

/** Repeating strobe: active for width steps at the start of each period. */
export function strobePattern(opts: {
  totalSteps: number;
  period?: number;
  width?: number;
}): BitState[] {
  const { totalSteps, period = 4, width = 1 } = opts;
  const cycle = Math.max(1, period);
  const pulseWidth = Math.min(Math.max(1, width), cycle);

  return Array.from({ length: totalSteps }, (_, i) => {
    const pos = i % cycle;
    return pos < pulseWidth ? '1' : '0';
  });
}

/** PWM: fixed period with configurable duty cycle (0.0–1.0). */
export function pwmPattern(opts: {
  totalSteps: number;
  period?: number;
  dutyCycle?: number;
}): BitState[] {
  const { totalSteps, period = 4, dutyCycle = 0.5 } = opts;
  const cycle = Math.max(1, period);
  const duty = Math.min(1, Math.max(0, dutyCycle));
  const highSteps = Math.min(cycle, Math.round(cycle * duty));

  return Array.from({ length: totalSteps }, (_, i) => {
    const pos = i % cycle;
    return pos < highSteps ? '1' : '0';
  });
}

/** Walking one on a single bit line: one high pulse per bits-wide cycle, shifting each cycle. */
export function walkingOnePattern(opts: {
  totalSteps: number;
  bits?: number;
}): BitState[] {
  const { totalSteps, bits = 4 } = opts;
  const width = clampBits(bits);

  return Array.from({ length: totalSteps }, (_, s) => {
    const posInBlock = s % width;
    const block = Math.floor(s / width);
    return posInBlock === block % width ? '1' : '0';
  });
}

/** Walking zero: inverse of walking one. */
export function walkingZeroPattern(opts: {
  totalSteps: number;
  bits?: number;
}): BitState[] {
  return walkingOnePattern(opts).map((s) => (s === '1' ? '0' : '1'));
}

/** Alternating 0/1 with configurable starting level. */
export function alternatingPattern(opts: {
  totalSteps: number;
  startHigh?: boolean;
}): BitState[] {
  const { totalSteps, startHigh = true } = opts;
  return Array.from({ length: totalSteps }, (_, i) => {
    const high = startHigh ? i % 2 === 0 : i % 2 === 1;
    return high ? '1' : '0';
  });
}

// ── Vector patterns ───────────────────────────────────────────────────────────

/** Binary counter on a bus; one segment per contiguous run of the same label. */
export function counterPattern(opts: {
  totalSteps: number;
  bits?: number;
  format?: 'hex' | 'dec' | 'bin';
}): VectorSegment[] {
  const { totalSteps, bits = 4, format = 'hex' } = opts;
  const width = clampBits(bits);
  const maxVal = 1 << width;

  return stepsToSegments(totalSteps, (step) =>
    formatValue(step % maxVal, width, format),
  );
}

/** All steps show a neutral idle label. */
export function busIdlePattern(opts: {
  totalSteps: number;
  idleLabel?: string;
}): VectorSegment[] {
  const { totalSteps, idleLabel = 'IDLE' } = opts;
  if (totalSteps <= 0) return [];
  return [
    {
      id: nanoid(),
      startStep: 0,
      endStep: totalSteps,
      value: idleLabel,
    },
  ];
}

/** Gray-code counter on a bus. */
export function grayCodePattern(opts: {
  totalSteps: number;
  bits?: number;
  format?: 'hex' | 'dec' | 'bin' | 'gray';
}): VectorSegment[] {
  const { totalSteps, bits = 4, format = 'gray' } = opts;
  const width = clampBits(bits);
  const maxVal = 1 << width;

  return stepsToSegments(totalSteps, (step) => {
    const g = grayCode(step % maxVal);
    if (format === 'gray') {
      return g.toString(2).padStart(width, '0');
    }
    return formatValue(g, width, format);
  });
}
