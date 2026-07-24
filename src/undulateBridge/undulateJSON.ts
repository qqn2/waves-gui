import { nanoid } from 'nanoid';
import { buildRowLayout } from '../renderer/rowLayout';
import {
  annotationXCells,
  annotationYLogical,
} from '../renderer/annotationLayout';
import { ROW_HEIGHT } from '../shared/constants';
import { normalizeDiagram } from '../shared/normalizeDiagram';
import {
  DEFAULT_ANALOGUE_MAX,
  DEFAULT_ANALOGUE_MIN,
  MAX_ANALOGUE_SAMPLES_PER_CELL,
} from '../shared/analogue';
import {
  isSafeAnnotationColor,
  isSafeAnnotationDasharray,
  isSafeAnnotationStrokeWidth,
  MAX_ANNOTATION_COORDINATE,
} from '../shared/annotations';
import type {
  AnnotationStyle,
  AnalogueCell,
  DiagramAnnotation,
  DiagramState,
  HorizontalLineAnnotation,
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
  UndulateAnnotation,
  UndulateRoot,
} from './types';
import type {
  WdGroup,
  WdSignal,
  WdSignalEntry,
} from '../wavedromBridge';

export const UNDULATE_TARGET_REVISION =
  'c8da7d48c48fc0bbc90113b6913611132bd96c01';

function annotationStyleToUndulate(
  style: AnnotationStyle | undefined,
): Record<string, unknown> {
  if (!style) return {};
  return {
    ...(style.fill !== undefined ? { fill: style.fill } : {}),
    ...(style.stroke !== undefined ? { stroke: style.stroke } : {}),
    ...(style.strokeWidth !== undefined
      ? { 'stroke-width': style.strokeWidth }
      : {}),
    ...(style.strokeDasharray !== undefined
      ? { 'stroke-dasharray': [...style.strokeDasharray] }
      : {}),
  };
}

function annotationStyleFromUndulate(
  annotation: Record<string, unknown>,
): AnnotationStyle | undefined {
  const style: AnnotationStyle = {};
  if (typeof annotation.fill === 'string') style.fill = annotation.fill;
  if (typeof annotation.stroke === 'string') style.stroke = annotation.stroke;
  if (typeof annotation['stroke-width'] === 'number') {
    style.strokeWidth = annotation['stroke-width'];
  }
  if (Array.isArray(annotation['stroke-dasharray'])) {
    style.strokeDasharray = annotation['stroke-dasharray'] as number[];
  }
  return Object.keys(style).length > 0 ? style : undefined;
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
  const annotations: UndulateAnnotation[] = [];

  for (const annotation of diagram.annotations ?? []) {
    if (
      annotation.type === 'vertical-line'
      || annotation.type === 'global-compression'
    ) {
      annotations.push({
        shape: annotation.type === 'vertical-line' ? '|' : '||',
        x: annotationXCells(annotation),
        ...annotationStyleToUndulate(annotation.style),
      });
    } else {
      const logicalY = annotationYLogical(annotation, rows);
      if (logicalY === null) continue;
      if (annotation.type === 'horizontal-line') {
        annotations.push({
          shape: '-',
          y: logicalY / ROW_HEIGHT,
          ...annotationStyleToUndulate(annotation.style),
        });
      } else {
        annotations.push({
          text: annotation.text,
          x: annotationXCells(annotation),
          y: logicalY / ROW_HEIGHT,
          ...annotationStyleToUndulate(annotation.style),
        });
      }
    }
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

export function isUndulateJSON(value: unknown): value is UndulateRoot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const root = value as { annotations?: unknown; signal?: unknown };
  if (Object.prototype.hasOwnProperty.call(root, 'annotations')) return true;
  if (!Array.isArray(root.signal)) return false;
  return visitRawSignals(
    root.signal,
    (signal) => (
      Object.prototype.hasOwnProperty.call(signal, 'analogue') ? 'found' : null
    ),
  ) === 'found';
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
  const supportedFields = new Set([
    'name',
    'wave',
    'analogue',
    'repeat',
    'slewing',
    'vscale',
    'overlay',
    'order',
    'period',
    'phase',
    'node',
  ]);
  const unsupportedField = Object.keys(signal).find(
    (field) => !supportedFields.has(field),
  );
  if (unsupportedField) {
    return `Unsupported Undulate analogue field: ${unsupportedField}`;
  }
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
  if (
    signal.overlay !== undefined
    && typeof signal.overlay !== 'boolean'
  ) {
    return 'Undulate overlay must be a boolean';
  }
  if (
    signal.order !== undefined
    && (
      typeof signal.order !== 'number'
      || !Number.isInteger(signal.order)
      || signal.order < 0
      || signal.order > 4
    )
  ) {
    return 'Undulate order must be an integer from 0 to 4';
  }
  return null;
}

function waveDromValidationView(root: UndulateRoot): UndulateRoot {
  const clone = JSON.parse(JSON.stringify(root)) as UndulateRoot;
  if (Array.isArray(clone.signal)) {
    visitRawSignals(clone.signal, (signal) => {
      if (signal.analogue !== undefined && typeof signal.wave === 'string') {
        signal.wave = signal.wave.replace(/[sca mMlLhH]/g, '.');
      }
      return null;
    });
  }
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
  const styleFields = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray'];
  const textFields = new Set(['text', 'x', 'y', ...styleFields]);
  const verticalFields = new Set(['shape', 'x', ...styleFields]);
  const horizontalFields = new Set(['shape', 'y', ...styleFields]);
  for (const annotation of root.annotations) {
    if (typeof annotation !== 'object' || annotation === null) {
      return 'Invalid Undulate annotation';
    }
    const record = annotation as Record<string, unknown>;
    const wipField = Object.keys(record).find((field) => (
      ['from', 'to', 'dx', 'dy', 'font-size', 'text_background'].includes(field)
    ));
    if (wipField) {
      return `[WIP] Undulate annotation ${wipField} is planned but not supported yet`;
    }
    const fields =
      record.shape === '|' || record.shape === '||' ? verticalFields
        : record.shape === '-' ? horizontalFields
          : textFields;
    if (
      record.shape !== undefined
      && record.shape !== '|'
      && record.shape !== '||'
      && record.shape !== '-'
    ) {
      return `Unsupported Undulate annotation shape: ${String(record.shape)}`;
    }
    const unsupportedField = Object.keys(record).find(
      (field) => !fields.has(field),
    );
    if (unsupportedField) {
      return `Unsupported Undulate annotation field: ${unsupportedField}`;
    }
    for (const field of ['fill', 'stroke']) {
      if (record[field] !== undefined && !isSafeAnnotationColor(record[field])) {
        return `Undulate annotation ${field} must be a safe hex, rgb(), or rgba() color`;
      }
    }
    if (
      record['stroke-width'] !== undefined
      && !isSafeAnnotationStrokeWidth(record['stroke-width'])
    ) {
      return 'Undulate annotation stroke-width must be a finite number from 0 to 32';
    }
    if (
      record['stroke-dasharray'] !== undefined
      && !isSafeAnnotationDasharray(record['stroke-dasharray'])
    ) {
      return 'Undulate annotation stroke-dasharray must contain 1 to 16 finite values from 0 to 1000';
    }
    if (record.shape === '|' || record.shape === '||') {
      if (
        typeof record.x !== 'number'
        || !Number.isFinite(record.x)
        || Math.abs(record.x) > MAX_ANNOTATION_COORDINATE
      ) {
        return `Undulate ${record.shape === '||' ? 'global compression' : 'vertical line'} requires a finite x coordinate`;
      }
      continue;
    }
    if (record.shape === '-') {
      if (
        typeof record.y !== 'number'
        || !Number.isFinite(record.y)
        || Math.abs(record.y) > MAX_ANNOTATION_COORDINATE
      ) {
        return 'Undulate horizontal line requires a finite y coordinate';
      }
      continue;
    }
    if (typeof record.text !== 'string') {
      return 'Undulate text annotation requires text';
    }
    if (
      typeof record.x !== 'number'
      || !Number.isFinite(record.x)
      || Math.abs(record.x) > MAX_ANNOTATION_COORDINATE
      || typeof record.y !== 'number'
      || !Number.isFinite(record.y)
      || Math.abs(record.y) > MAX_ANNOTATION_COORDINATE
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
  const annotations = (root.annotations ?? []).map((annotation): DiagramAnnotation => {
    const style = annotationStyleFromUndulate(
      annotation as unknown as Record<string, unknown>,
    );
    if (
      'shape' in annotation
      && (annotation.shape === '|' || annotation.shape === '||')
    ) {
      return {
        id: nanoid(),
        type:
          annotation.shape === '|'
            ? 'vertical-line'
            : 'global-compression',
        tick: Math.round(annotation.x - 0.5),
        x: annotation.x,
        snapToGrid: false,
        ...(style ? { style } : {}),
      };
    }
    if ('shape' in annotation && annotation.shape === '-') {
      const base: HorizontalLineAnnotation = {
        id: nanoid(),
        type: 'horizontal-line',
        y: annotation.y,
        coordinateMode: 'diagram',
        ...(style ? { style } : {}),
      };
      return base;
    }
    const base = {
      id: nanoid(),
      type: 'text' as const,
      text: annotation.text,
      tick: Math.round(annotation.x - 0.5),
      x: annotation.x,
      y: annotation.y,
      coordinateMode: 'diagram' as const,
      snapToGrid: false,
      ...(style ? { style } : {}),
    };
    return base;
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
