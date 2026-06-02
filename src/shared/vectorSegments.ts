import { nanoid } from 'nanoid';
import type { VectorSegment } from './types';

/** Sentinel stored in segment.value — maps to WaveDrom bus `x` (no data[] entry). */
export const VECTOR_UNKNOWN_LABEL = 'x';

type StepCell = string | null;

function stepsFromSegments(
  segments: VectorSegment[],
  totalSteps: number,
): StepCell[] {
  const steps: StepCell[] = Array.from({ length: totalSteps }, () => null);
  for (const seg of segments) {
    for (let i = seg.startStep; i < seg.endStep && i < totalSteps; i++) {
      steps[i] = seg.value;
    }
  }
  return steps;
}

function segmentsFromSteps(steps: StepCell[]): VectorSegment[] {
  const out: VectorSegment[] = [];
  let i = 0;
  while (i < steps.length) {
    if (steps[i] === null) {
      i++;
      continue;
    }
    const value = steps[i]!;
    let j = i + 1;
    while (j < steps.length && steps[j] === value) j++;
    out.push({
      id: nanoid(),
      startStep: i,
      endStep: j,
      value,
    });
    i = j;
  }
  return out;
}

/** Paint or clear a bus value across inclusive step range; idle cells become wave `.` */
export function applyVectorSpan(
  segments: VectorSegment[],
  startStep: number,
  endStepInclusive: number,
  value: string | null,
  totalSteps: number,
): VectorSegment[] {
  const steps = stepsFromSegments(segments, totalSteps);
  const lo = Math.max(0, startStep);
  const hi = Math.min(totalSteps - 1, endStepInclusive);
  for (let i = lo; i <= hi; i++) {
    steps[i] = value;
  }
  return segmentsFromSteps(steps);
}

/** WaveDrom `wave` + `data[]` for a vector lane (digits 2–9 for multi-cycle labels). */
export function segmentsToWaveAndData(
  segments: VectorSegment[],
  totalSteps: number,
): { wave: string; data: string[] } {
  const steps = stepsFromSegments(segments, totalSteps);
  let wave = '';
  const data: string[] = [];

  let i = 0;
  while (i < totalSteps) {
    const v = steps[i];
    if (v === null) {
      wave += '.';
      i++;
      continue;
    }
    if (v === VECTOR_UNKNOWN_LABEL) {
      wave += 'x';
      i++;
      continue;
    }
    let j = i + 1;
    while (j < totalSteps && steps[j] === v) j++;
    const span = j - i;
    wave += '=';
    for (let k = 1; k < span; k++) wave += '.';
    data.push(v);
    i = j;
  }

  while (wave.length < totalSteps) wave += '.';
  if (wave.length > totalSteps) wave = wave.slice(0, totalSteps);
  return { wave, data };
}
