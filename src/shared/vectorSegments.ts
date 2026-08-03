import { nanoid } from 'nanoid';
import {
  colorIndexFromFillHex,
  colorIndexToWaveChar,
  fillHexForColorIndex,
  waveCharToColorIndex,
} from '../wavedromBridge/wavedromColors';
import type { VectorSegment } from './types';

/** Sentinel stored in segment.value — maps to WaveDrom bus `x` (no data[] entry). */
export const VECTOR_UNKNOWN_LABEL = 'x';

type StepCell = { value: string; color?: string } | null;

function stepsFromSegments(
  segments: VectorSegment[],
  totalSteps: number,
): StepCell[] {
  const steps: StepCell[] = Array.from({ length: totalSteps }, () => null);
  for (const seg of segments) {
    for (let i = seg.startStep; i < seg.endStep && i < totalSteps; i++) {
      steps[i] = { value: seg.value, color: seg.color };
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
    const value = steps[i]!.value;
    const color = steps[i]!.color;
    let j = i + 1;
    while (
      j < steps.length &&
      steps[j] !== null &&
      steps[j]!.value === value &&
      steps[j]!.color === color
    ) {
      j++;
    }
    out.push({
      id: nanoid(),
      startStep: i,
      endStep: j,
      value,
      ...(color !== undefined ? { color } : {}),
    });
    i = j;
  }
  return out;
}

/** Paint or clear a bus value across inclusive step range; idle cells become wave `.` */
export function segmentAtStep(
  segments: VectorSegment[],
  step: number,
): VectorSegment | undefined {
  return segments.find((seg) => step >= seg.startStep && step < seg.endStep);
}

/** Keep native-timed vector segments ordered, contiguous and within the cell track. */
export function normalizeTimedVectorSegments(
  segments: VectorSegment[],
  cellCount: number,
): VectorSegment[] {
  const count = Math.max(1, Math.floor(cellCount));
  const sorted = segments
    .map((segment) => ({
      ...segment,
      startStep: Math.max(0, Math.min(count, Math.floor(segment.startStep))),
      endStep: Math.max(0, Math.min(count, Math.floor(segment.endStep))),
    }))
    .sort((a, b) => a.startStep - b.startStep || a.endStep - b.endStep);
  const out: VectorSegment[] = [];
  let cursor = 0;
  for (const segment of sorted) {
    const start = Math.max(cursor, segment.startStep);
    const end = Math.max(start, segment.endStep);
    if (start > cursor) {
      const previous = out.at(-1);
      if (previous) {
        previous.endStep = start;
      } else {
        out.push({ id: nanoid(), startStep: 0, endStep: start, value: '' });
      }
    }
    if (end <= start) continue;
    out.push({ ...segment, startStep: start, endStep: end });
    cursor = end;
  }
  if (out.length === 0) {
    return [{ id: nanoid(), startStep: 0, endStep: count, value: '' }];
  }
  if (out[0]!.startStep > 0) out[0]!.startStep = 0;
  const last = out.at(-1)!;
  if (last.endStep < count) last.endStep = count;
  return out;
}

export interface ApplyVectorSpanOptions {
  /** Keep labels (and colors) on steps that already hold bus data. */
  preserveExistingLabels?: boolean;
}

/** Paint or clear a bus value across inclusive step range; idle cells become wave `.` */
export function applyVectorSpan(
  segments: VectorSegment[],
  startStep: number,
  endStepInclusive: number,
  value: string | null,
  totalSteps: number,
  busColorFill?: string,
  options?: ApplyVectorSpanOptions,
): VectorSegment[] {
  const steps = stepsFromSegments(segments, totalSteps);
  const lo = Math.max(0, startStep);
  const hi = Math.min(totalSteps - 1, endStepInclusive);
  const preserve = options?.preserveExistingLabels === true;
  for (let i = lo; i <= hi; i++) {
    if (value === null) {
      steps[i] = null;
    } else if (preserve && steps[i] !== null) {
      continue;
    } else {
      steps[i] = {
        value,
        ...(busColorFill !== undefined ? { color: busColorFill } : {}),
      };
    }
  }
  return segmentsFromSteps(steps);
}

/** WaveDrom `wave` + `data[]` for a vector lane (digits 2–9 encode bus fill). */
export function segmentsToWaveAndData(
  segments: VectorSegment[],
  totalSteps: number,
  stepGaps?: boolean[],
): { wave: string; data: Array<string | string[]> } {
  const steps = stepsFromSegments(segments, totalSteps);
  let wave = '';
  const data: Array<string | string[]> = [];

  const gapChar = (column: number): string =>
    stepGaps?.[column] ? '|' : '.';

  let i = 0;
  while (i < totalSteps) {
    const cell = steps[i];
    if (cell === null) {
      wave += '.';
      i++;
      continue;
    }
    if (cell.value === VECTOR_UNKNOWN_LABEL) {
      let j = i + 1;
      while (j < totalSteps && steps[j]?.value === VECTOR_UNKNOWN_LABEL) {
        j++;
      }
      wave += 'x';
      for (let k = i + 1; k < j; k++) wave += gapChar(k);
      i = j;
      continue;
    }
    let j = i + 1;
    while (
      j < totalSteps &&
      steps[j] !== null &&
      steps[j]!.value === cell.value &&
      steps[j]!.color === cell.color
    ) {
      j++;
    }
    const span = j - i;
    const colorIndex = colorIndexFromFillHex(cell.color);
    wave += colorIndexToWaveChar(colorIndex);
    for (let k = 1; k < span; k++) wave += gapChar(i + k);
    if (cell.value.includes('\n')) {
      data.push(cell.value.split('\n'));
    } else {
      data.push(cell.value);
    }
    i = j;
  }

  while (wave.length < totalSteps) wave += '.';
  if (wave.length > totalSteps) wave = wave.slice(0, totalSteps);
  return { wave, data };
}

/** Import helper: map a WaveDrom bus wave character to segment fill. */
export function fillHexForWaveChar(ch: string): string | undefined {
  const idx = waveCharToColorIndex(ch);
  return idx !== null ? fillHexForColorIndex(idx) : undefined;
}
