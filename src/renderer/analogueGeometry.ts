import {
  DEFAULT_ANALOGUE_MAX,
  DEFAULT_ANALOGUE_MIN,
} from '../shared/analogue';
import type { Signal } from '../shared/types';

export interface AnaloguePathPoint {
  step: number;
  value: number;
}

const CAPACITIVE_SAMPLES = 16;

function pushPoint(
  points: AnaloguePathPoint[],
  step: number,
  value: number,
): void {
  const last = points[points.length - 1];
  if (last?.step === step && last.value === value) return;
  points.push({ step, value });
}

export function analoguePathPoints(signal: Signal): AnaloguePathPoint[] {
  const cells = signal.analogueCells ?? [];
  const min = signal.analogueMin ?? DEFAULT_ANALOGUE_MIN;
  const max = signal.analogueMax ?? DEFAULT_ANALOGUE_MAX;
  const range = Math.max(Number.EPSILON, max - min);
  let previous = min;
  const points: AnaloguePathPoint[] = [{ step: 0, value: previous }];

  cells.forEach((cell, index) => {
    const start = index;
    const end = index + 1;
    if (cell.kind === 'samples' && cell.samples?.length) {
      for (const sample of cell.samples) {
        pushPoint(points, start + sample.offset, sample.value);
      }
      previous = cell.value;
      pushPoint(points, end, previous);
      return;
    }
    if (cell.kind === 'capacitive') {
      const denominator = 1 - Math.exp(-5);
      for (let sample = 1; sample <= CAPACITIVE_SAMPLES; sample++) {
        const t = sample / CAPACITIVE_SAMPLES;
        const eased = (1 - Math.exp(-5 * t)) / denominator;
        pushPoint(
          points,
          start + t,
          previous + (cell.value - previous) * eased,
        );
      }
      previous = cell.value;
      return;
    }
    if (cell.kind === 'step') {
      const delta = Math.abs(cell.value - previous);
      const transitionFraction =
        signal.slewing && signal.slewing > 0
          ? Math.min(0.9, Math.max(0.02, (delta / range) * signal.slewing / 32))
          : 0;
      pushPoint(points, start + transitionFraction, cell.value);
      previous = cell.value;
      pushPoint(points, end, previous);
      return;
    }
    if (cell.kind === 'impulse-low' || cell.kind === 'impulse-high') {
      const base = cell.kind === 'impulse-low' ? max : min;
      const pulse = cell.kind === 'impulse-low' ? min : max;
      pushPoint(points, start, base);
      pushPoint(points, start + 0.5, base);
      pushPoint(points, start + 0.5, pulse);
      pushPoint(points, start + 0.5, base);
      pushPoint(points, end, base);
      previous = base;
      return;
    }
    if (
      cell.kind === 'metastable-low'
      || cell.kind === 'metastable-high'
    ) {
      const resolvesHigh = cell.kind === 'metastable-high';
      const samples = 28;
      for (let sample = 0; sample <= samples; sample++) {
        const t = (sample / samples) * 0.75;
        const amplitude = Math.exp(2 * (t - 1));
        const phase = resolvesHigh ? Math.PI : 0;
        const normalized =
          (1 + amplitude * Math.sin(phase + 8 * Math.PI * t)) / 2;
        pushPoint(points, start + t, min + normalized * range);
      }
      previous = resolvesHigh ? max : min;
      pushPoint(points, end, previous);
      return;
    }

    if (cell.value !== previous) {
      pushPoint(points, start, cell.value);
      previous = cell.value;
    }
    pushPoint(points, end, previous);
  });
  return points;
}

export function analogueValueRatio(signal: Signal, value: number): number {
  const min = signal.analogueMin ?? DEFAULT_ANALOGUE_MIN;
  const max = signal.analogueMax ?? DEFAULT_ANALOGUE_MAX;
  return Math.max(0, Math.min(1, (value - min) / Math.max(Number.EPSILON, max - min)));
}
