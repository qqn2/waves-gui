import { nanoid } from 'nanoid';
import type { AnalogueCell, AnaloguePoint, Signal } from './types';
import { ROW_HEIGHT } from './constants';
import { ANALOGUE_EXPRESSION_MAX_LENGTH } from './analogueExpressions';

export const DEFAULT_ANALOGUE_MIN = 0;
export const DEFAULT_ANALOGUE_MAX = 1.8;
export const MAX_ANALOGUE_ABS_VALUE = 1_000_000_000;
export const MAX_ANALOGUE_SAMPLES_PER_CELL = 4096;

function finiteClamped(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(
    -MAX_ANALOGUE_ABS_VALUE,
    Math.min(MAX_ANALOGUE_ABS_VALUE, value),
  );
}

function normalizePoint(value: Partial<AnaloguePoint>): AnaloguePoint | null {
  if (
    typeof value.offset !== 'number'
    || !Number.isFinite(value.offset)
    || typeof value.value !== 'number'
    || !Number.isFinite(value.value)
  ) return null;
  return {
    offset: Math.max(0, Math.min(1, value.offset)),
    value: finiteClamped(value.value, 0),
  };
}

export function normalizeAnalogueCell(
  value: Partial<AnalogueCell> | undefined,
  fallbackValue: number,
): AnalogueCell {
  const kind =
    value?.kind === 'step'
    || value?.kind === 'capacitive'
    || value?.kind === 'samples'
      ? value.kind
      : 'hold';
  let samples =
    kind === 'samples' && Array.isArray(value?.samples)
      ? value.samples
          .slice(0, MAX_ANALOGUE_SAMPLES_PER_CELL)
          .map(normalizePoint)
          .filter((point): point is AnaloguePoint => point !== null)
          .sort((a, b) => a.offset - b.offset)
      : undefined;
  const lastSample = samples?.[samples.length - 1];
  const normalizedValue = finiteClamped(
    value?.value,
    lastSample?.value ?? fallbackValue,
  );
  if (kind === 'samples' && (!samples || samples.length === 0)) {
    samples = [
      { offset: 0, value: fallbackValue },
      { offset: 1, value: normalizedValue },
    ];
  }
  return {
    id:
      typeof value?.id === 'string' && value.id.length > 0
        ? value.id
        : nanoid(),
    kind,
    value: normalizedValue,
    ...(samples && samples.length > 0 ? { samples } : {}),
    ...(typeof value?.expression === 'string'
      && value.expression.length > 0
      && value.expression.length <= ANALOGUE_EXPRESSION_MAX_LENGTH
      ? { expression: value.expression }
      : {}),
  };
}

export function normalizeAnalogueSignal(
  signal: Signal,
  totalSteps: number,
): void {
  const min = finiteClamped(signal.analogueMin, DEFAULT_ANALOGUE_MIN);
  const requestedMax = finiteClamped(signal.analogueMax, DEFAULT_ANALOGUE_MAX);
  signal.analogueMin = Math.min(min, requestedMax);
  signal.analogueMax =
    requestedMax > signal.analogueMin
      ? requestedMax
      : Math.min(MAX_ANALOGUE_ABS_VALUE, signal.analogueMin + 1);
  if (typeof signal.slewing === 'number' && Number.isFinite(signal.slewing)) {
    signal.slewing = Math.max(0, signal.slewing);
  } else {
    delete signal.slewing;
  }
  if (typeof signal.vscale === 'number' && Number.isFinite(signal.vscale)) {
    signal.vscale = Math.max(0.25, Math.min(16, signal.vscale));
  } else {
    delete signal.vscale;
  }
  signal.rowHeight = ROW_HEIGHT * (signal.vscale ?? 1);
  if (typeof signal.order === 'number' && Number.isFinite(signal.order)) {
    signal.order = Math.max(0, Math.min(4, Math.round(signal.order)));
  } else {
    delete signal.order;
  }

  const source = Array.isArray(signal.analogueCells)
    ? signal.analogueCells
    : [];
  const cells: AnalogueCell[] = [];
  let previous = signal.analogueMin;
  for (let index = 0; index < totalSteps; index++) {
    const cell = normalizeAnalogueCell(source[index], previous);
    cells.push(cell);
    previous = cell.value;
  }
  signal.analogueCells = cells;
  signal.states = [];
  signal.segments = [];
}

export function resizeAnalogueCells(
  signal: Signal,
  newLength: number,
): void {
  const source = signal.analogueCells ?? [];
  const cells = source.slice(0, newLength);
  let previous =
    cells[cells.length - 1]?.value
    ?? signal.analogueMin
    ?? DEFAULT_ANALOGUE_MIN;
  while (cells.length < newLength) {
    const cell = normalizeAnalogueCell(undefined, previous);
    cells.push(cell);
    previous = cell.value;
  }
  signal.analogueCells = cells;
}
