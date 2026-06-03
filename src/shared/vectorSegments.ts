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

/** Placeholder segment values that map to idle wave `.` (no data[] entry). */
const IDLE_BUS_VALUES = new Set(['0', '']);

function isBusDataLabel(value: string): boolean {
  return value !== VECTOR_UNKNOWN_LABEL && !IDLE_BUS_VALUES.has(value);
}

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
export function applyVectorSpan(
  segments: VectorSegment[],
  startStep: number,
  endStepInclusive: number,
  value: string | null,
  totalSteps: number,
  busColorFill?: string,
): VectorSegment[] {
  const steps = stepsFromSegments(segments, totalSteps);
  const lo = Math.max(0, startStep);
  const hi = Math.min(totalSteps - 1, endStepInclusive);
  for (let i = lo; i <= hi; i++) {
    if (value === null) {
      steps[i] = null;
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
): { wave: string; data: string[] } {
  const steps = stepsFromSegments(segments, totalSteps);
  let wave = '';
  const data: string[] = [];

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
      for (let k = i + 1; k < j; k++) wave += '.';
      i = j;
      continue;
    }
    if (!isBusDataLabel(cell.value)) {
      wave += '.';
      i++;
      continue;
    }
    let j = i + 1;
    while (j < totalSteps && steps[j]?.value === cell.value && steps[j]?.color === cell.color) {
      j++;
    }
    const span = j - i;
    const colorIndex = colorIndexFromFillHex(cell.color);
    wave += colorIndexToWaveChar(colorIndex);
    for (let k = 1; k < span; k++) wave += '.';
    data.push(cell.value);
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
