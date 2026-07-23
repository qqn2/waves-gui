import { nanoid } from 'nanoid';
import { buildRowLayout } from '../renderer/rowLayout';
import { ROW_HEIGHT } from '../shared/constants';
import { normalizeDiagram } from '../shared/normalizeDiagram';
import {
  DEFAULT_ANALOGUE_MAX,
  DEFAULT_ANALOGUE_MIN,
  MAX_ANALOGUE_SAMPLES_PER_CELL,
} from '../shared/analogue';
import type {
  AnalogueCell,
  DiagramAnnotation,
  DiagramState,
  Signal,
  SignalOrGroup,
} from '../shared/types';
import {
  fromWavedromJSON,
  toWavedromJSON,
  validateWavedromJSON,
} from '../wavedromBridge';
import type {
  UndulateAnalogueValue,
  UndulateRoot,
  UndulateTextAnnotation,
} from './types';
import type {
  WdGroup,
  WdSignal,
  WdSignalEntry,
} from '../wavedromBridge';

export const UNDULATE_TARGET_REVISION =
  'c8da7d48c48fc0bbc90113b6913611132bd96c01';

function annotationLogicalY(
  annotation: DiagramAnnotation,
  rows: ReturnType<typeof buildRowLayout>,
): number | null {
  if (!annotation.signalId) return annotation.yOffset ?? 16;
  const row = rows.find((candidate) => candidate.id === annotation.signalId);
  if (!row) return null;
  return row.y + row.height / 2 + (annotation.yOffset ?? 0);
}

function analogueToUndulateEntry(signal: Signal): WdSignal {
  const cells = signal.analogueCells ?? [];
  const values: UndulateAnalogueValue[] = [];
  const wave = cells.map((cell, index) => {
    if (cell.kind === 'samples') {
      values.push(
        (cell.samples ?? []).map((point) => [point.offset, point.value]),
      );
      return 'a';
    }
    if (cell.kind === 'capacitive') {
      values.push(cell.value);
      return 'c';
    }
    if (cell.kind === 'step') {
      values.push(cell.value);
      return 's';
    }
    if (index === 0) {
      const midpoint =
        ((signal.analogueMin ?? DEFAULT_ANALOGUE_MIN)
          + (signal.analogueMax ?? DEFAULT_ANALOGUE_MAX)) / 2;
      return cell.value <= midpoint ? '0' : '1';
    }
    return '.';
  }).join('');
  return {
    name: signal.name,
    wave,
    analogue: values,
    ...(signal.slewing !== undefined ? { slewing: signal.slewing } : {}),
    ...(signal.vscale !== undefined ? { vscale: signal.vscale } : {}),
    ...(signal.overlay !== undefined ? { overlay: signal.overlay } : {}),
    ...(signal.order !== undefined ? { order: signal.order } : {}),
  };
}

function mergeUndulateSignalEntries(
  signals: SignalOrGroup[],
  sharedEntries: WdSignalEntry[],
): WdSignalEntry[] {
  return signals.map((signal, index) => {
    const shared = sharedEntries[index] ?? {};
    if (signal.type === 'group') {
      const sharedChildren =
        Array.isArray(shared) ? shared.slice(1) as WdSignalEntry[] : [];
      return [
        signal.name,
        ...mergeUndulateSignalEntries(signal.children, sharedChildren),
      ] as WdGroup;
    }
    return signal.type === 'analogue'
      ? analogueToUndulateEntry(signal)
      : shared;
  });
}

export function toUndulateJSON(diagram: DiagramState): UndulateRoot {
  const root: UndulateRoot = toWavedromJSON(diagram);
  root.signal = mergeUndulateSignalEntries(diagram.signals, root.signal);
  const rows = buildRowLayout(diagram.signals);
  const annotations: UndulateTextAnnotation[] = [];

  for (const annotation of diagram.annotations ?? []) {
    if (annotation.type !== 'text') continue;
    const logicalY = annotationLogicalY(annotation, rows);
    if (logicalY === null) continue;
    annotations.push({
      text: annotation.text,
      x: annotation.tick + 0.5,
      y: logicalY / ROW_HEIGHT,
    });
  }
  if (annotations.length > 0) root.annotations = annotations;
  return root;
}

function isWdGroup(entry: unknown): entry is [string, ...unknown[]] {
  return Array.isArray(entry) && typeof entry[0] === 'string';
}

function visitRawSignals(
  entries: unknown[],
  visit: (signal: Record<string, unknown>) => string | null,
): string | null {
  for (const entry of entries) {
    if (isWdGroup(entry)) {
      const error = visitRawSignals(entry.slice(1), visit);
      if (error) return error;
    } else if (
      typeof entry === 'object'
      && entry !== null
      && !Array.isArray(entry)
      && Object.keys(entry).length > 0
    ) {
      const error = visit(entry as Record<string, unknown>);
      if (error) return error;
    }
  }
  return null;
}

function isFinitePointList(value: unknown): value is Array<[number, number]> {
  return (
    Array.isArray(value)
    && value.length > 0
    && value.length <= MAX_ANALOGUE_SAMPLES_PER_CELL
    && value.every(
      (point) => (
        Array.isArray(point)
        && point.length === 2
        && typeof point[0] === 'number'
        && Number.isFinite(point[0])
        && typeof point[1] === 'number'
        && Number.isFinite(point[1])
      ),
    )
  );
}

function validateAnalogueSignal(signal: Record<string, unknown>): string | null {
  if (signal.analogue === undefined) return null;
  if (!Array.isArray(signal.analogue)) {
    return 'Undulate analogue must be an array';
  }
  if (typeof signal.wave !== 'string') {
    return 'Undulate analogue signal requires a wave string';
  }
  const repeat = signal.repeat ?? 1;
  if (
    typeof repeat !== 'number'
    || !Number.isInteger(repeat)
    || repeat < 1
    || repeat > 10_000
  ) {
    return 'Undulate analogue repeat must be an integer from 1 to 10000';
  }
  const expandedWave = signal.wave.repeat(repeat);
  const consumingKinds = [...expandedWave].filter((char) => /[sca]/.test(char));
  if (consumingKinds.length !== signal.analogue.length) {
    return 'Undulate analogue value count must match s/c/a wave cells';
  }
  for (let index = 0; index < consumingKinds.length; index++) {
    const kind = consumingKinds[index]!;
    const value = signal.analogue[index];
    if (kind === 'a') {
      if (!isFinitePointList(value)) {
        return 'Undulate arbitrary analogue cells require finite [time, value] points';
      }
    } else if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'Undulate step/capacitive values must be finite numbers; expressions are not executed';
    }
  }
  for (const field of ['slewing', 'vscale']) {
    const value = signal[field];
    if (
      value !== undefined
      && (typeof value !== 'number' || !Number.isFinite(value))
    ) {
      return `Undulate ${field} must be a finite number`;
    }
  }
  return null;
}

function waveDromValidationView(root: UndulateRoot): UndulateRoot {
  const clone = JSON.parse(JSON.stringify(root)) as UndulateRoot;
  visitRawSignals(clone.signal, (signal) => {
    if (signal.analogue !== undefined && typeof signal.wave === 'string') {
      signal.wave = signal.wave.replace(/[sca mMlLhH]/g, '.');
    }
    return null;
  });
  return clone;
}

export function validateUndulateJSON(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return validateWavedromJSON(value);
  }
  const waveError = validateWavedromJSON(
    waveDromValidationView(value as UndulateRoot),
  );
  if (waveError) return waveError;
  const analogueError = visitRawSignals(
    (value as UndulateRoot).signal,
    validateAnalogueSignal,
  );
  if (analogueError) return analogueError;
  const root = value as { annotations?: unknown };
  if (root.annotations === undefined) return null;
  if (!Array.isArray(root.annotations)) return 'annotations must be an array';
  const supportedFields = new Set(['text', 'x', 'y']);
  for (const annotation of root.annotations) {
    if (typeof annotation !== 'object' || annotation === null) {
      return 'Invalid Undulate annotation';
    }
    const record = annotation as Record<string, unknown>;
    if (record.shape !== undefined) {
      return `Unsupported Undulate annotation shape: ${String(record.shape)}`;
    }
    const unsupportedField = Object.keys(record).find(
      (field) => !supportedFields.has(field),
    );
    if (unsupportedField) {
      return `Unsupported Undulate text annotation field: ${unsupportedField}`;
    }
    if (typeof record.text !== 'string') {
      return 'Undulate text annotation requires text';
    }
    if (
      typeof record.x !== 'number'
      || !Number.isFinite(record.x)
      || typeof record.y !== 'number'
      || !Number.isFinite(record.y)
    ) {
      return 'Undulate text annotation requires finite x and y coordinates';
    }
  }
  return null;
}

function flattenRawSignals(entries: WdSignalEntry[]): WdSignal[] {
  const signals: WdSignal[] = [];
  for (const entry of entries) {
    if (Array.isArray(entry)) {
      signals.push(...flattenRawSignals(entry.slice(1) as WdSignalEntry[]));
    } else if (Object.keys(entry).length > 0) {
      signals.push(entry as WdSignal);
    }
  }
  return signals;
}

function flattenDiagramSignals(entries: SignalOrGroup[]): Signal[] {
  const signals: Signal[] = [];
  for (const entry of entries) {
    if (entry.type === 'group') {
      signals.push(...flattenDiagramSignals(entry.children));
    } else if (entry.type !== 'spacer') {
      signals.push(entry);
    }
  }
  return signals;
}

function sampledCell(
  raw: Array<[number, number]>,
  previous: number,
): AnalogueCell {
  const minTime = raw[0]![0];
  const maxTime = raw[raw.length - 1]![0];
  const span = maxTime - minTime;
  const samples = raw.map(([time, value]) => ({
    offset: span > 0 ? (time - minTime) / span : 0,
    value,
  }));
  return {
    id: nanoid(),
    kind: 'samples',
    value: samples[samples.length - 1]?.value ?? previous,
    samples,
  };
}

function importAnalogueSignal(raw: WdSignal, parsed: Signal): void {
  if (!Array.isArray(raw.analogue) || typeof raw.wave !== 'string') return;
  const repeat = typeof raw.repeat === 'number' ? raw.repeat : 1;
  const wave = raw.wave.repeat(repeat);
  const values = raw.analogue as UndulateAnalogueValue[];
  const min = DEFAULT_ANALOGUE_MIN;
  const max = DEFAULT_ANALOGUE_MAX;
  let valueIndex = 0;
  let previous = min;
  const cells: AnalogueCell[] = [];
  for (const char of wave) {
    let cell: AnalogueCell;
    if (char === 's' || char === 'c') {
      const value = values[valueIndex++] as number;
      cell = {
        id: nanoid(),
        kind: char === 's' ? 'step' : 'capacitive',
        value,
      };
    } else if (char === 'a') {
      cell = sampledCell(
        values[valueIndex++] as Array<[number, number]>,
        previous,
      );
    } else {
      if (/[1hH]/.test(char)) previous = max;
      if (/[0lL]/.test(char)) previous = min;
      cell = { id: nanoid(), kind: 'hold', value: previous };
    }
    cells.push(cell);
    previous = cell.value;
  }
  parsed.type = 'analogue';
  parsed.states = [];
  parsed.segments = [];
  parsed.analogueMin = min;
  parsed.analogueMax = max;
  parsed.analogueCells = cells;
  if (typeof raw.slewing === 'number') parsed.slewing = raw.slewing;
  if (typeof raw.vscale === 'number') parsed.vscale = raw.vscale;
  if (typeof raw.overlay === 'boolean') parsed.overlay = raw.overlay;
  if (typeof raw.order === 'number') parsed.order = raw.order;
  parsed.rowHeight = ROW_HEIGHT * (parsed.vscale ?? 1);
}

export function fromUndulateJSON(root: UndulateRoot): DiagramState {
  const diagram = fromWavedromJSON(root);
  const rawSignals = flattenRawSignals(root.signal);
  const parsedSignals = flattenDiagramSignals(diagram.signals);
  rawSignals.forEach((raw, index) => {
    const parsed = parsedSignals[index];
    if (parsed) importAnalogueSignal(raw, parsed);
  });
  diagram.config.totalSteps = Math.max(
    diagram.config.totalSteps,
    ...parsedSignals.map((signal) => signal.analogueCells?.length ?? 0),
  );
  const rows = buildRowLayout(diagram.signals);
  const laneRows = rows.filter(
    (row) => row.type === 'bit' || row.type === 'vector',
  );
  const annotations = (root.annotations ?? []).map((annotation) => {
    const logicalY = annotation.y * ROW_HEIGHT;
    const row = laneRows.find(
      (candidate) => (
        logicalY >= candidate.y
        && logicalY <= candidate.y + candidate.height
      ),
    );
    const base = {
      id: nanoid(),
      type: 'text' as const,
      text: annotation.text,
      tick: Math.round(annotation.x - 0.5),
    };
    return row
      ? {
          ...base,
          signalId: row.id,
          yOffset: logicalY - (row.y + row.height / 2),
        }
      : {
          ...base,
          yOffset: logicalY,
        };
  });

  return normalizeDiagram({
    ...diagram,
    version: 2,
    compatibility: {
      extensionsEnabled:
        annotations.length > 0
        || parsedSignals.some((signal) => signal.type === 'analogue'),
      sourceFormat: 'undulate-json',
      sourceRevision: UNDULATE_TARGET_REVISION,
    },
    annotations,
  });
}
