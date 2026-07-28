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
} from '../shared/analogue';
import { timingForStates, timingResolution } from '../shared/fineTiming';
import {
} from '../shared/annotations';
import type {
  AnnotationStyle,
  AnnotationAnchor,
  AnnotationRangePosition,
  AnalogueCell,
  DiagramAnnotation,
  DiagramState,
  GlobalCompressionAnnotation,
  HorizontalLineAnnotation,
  Signal,
  SignalOrGroup,
  VerticalLineAnnotation,
} from '../shared/types';
import { fromWavedromJSON, toWavedromJSON } from '../wavedromBridge';
import type {
  UndulateAnalogueValue,
  UndulateAnnotation,
  UndulateAnnotationRange,
  UndulateAnnotationAnchor,
  UndulateRoot,
} from './types';
import type {
  WdGroup,
  WdSignal,
  WdSignalEntry,
} from '../wavedromBridge';

export {
  UNDULATE_TARGET_REVISION,
  isUndulateJSON,
  validateUndulateFindings,
  validateUndulateJSON,
} from './validation';
import { UNDULATE_TARGET_REVISION } from './validation';

function annotationRangeFromUndulate(
  value: UndulateAnnotationRange | undefined,
): AnnotationRangePosition | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { unit: 'index', value };
  }
  if (typeof value !== 'string') return undefined;
  const match = value.trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*%$/);
  if (!match) return undefined;
  const percent = Number(match[1]);
  return Number.isFinite(percent)
    ? { unit: 'percent', value: percent }
    : undefined;
}

function annotationRangeToUndulate(
  value: AnnotationRangePosition | undefined,
): UndulateAnnotationRange | undefined {
  if (!value) return undefined;
  return value.unit === 'percent' ? `${value.value}%` : value.value;
}

function annotationRangesToUndulate(
  annotation:
    | VerticalLineAnnotation
    | HorizontalLineAnnotation
    | GlobalCompressionAnnotation,
): { from?: UndulateAnnotationRange; to?: UndulateAnnotationRange } {
  const from = annotationRangeToUndulate(annotation.rangeFrom);
  const to = annotationRangeToUndulate(annotation.rangeTo);
  return {
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
  };
}

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
    if (signal.type === 'analogue') return analogueToUndulateEntry(signal);
    if (signal.type === 'bit' && signal.digitalTiming) {
      const timing = signal.digitalTiming;
      const entry = { ...(shared as WdSignal) };
      entry.wave = (shared as WdSignal).wave
        ?? signal.states.slice(0, timing.cells.length).join('');
      const periods = timing.cells.map(
        (cell) => cell.durationTicks / timing.ticksPerStep,
      );
      if (periods.length > 0 && periods.every((value) => value === periods[0])) {
        entry.period = periods[0];
        delete entry.periods;
      } else {
        entry.periods = periods;
        delete entry.period;
      }
      const dutyCycles = timing.cells.map((cell) =>
        cell.dutyTicks === undefined ? 0.5 : cell.dutyTicks / cell.durationTicks,
      );
      if (dutyCycles.some((value) => value !== 0.5)) {
        if (dutyCycles.every((value) => value === dutyCycles[0])) {
          entry.duty_cycle = dutyCycles[0];
        } else {
          entry.duty_cycles = dutyCycles;
        }
      }
      entry.phase = timing.phaseTicks / timing.ticksPerStep;
      if (timing.slewing !== undefined) entry.slewing = timing.slewing;
      delete entry.repeat;
      return entry;
    }
    return shared;
  });
}

function anchorToUndulate(anchor: AnnotationAnchor): UndulateAnnotationAnchor {
  if (anchor.kind === 'point') {
    return anchor.percent
      ? [`${anchor.x}%`, `${anchor.y}%`]
      : [anchor.x, anchor.y];
  }
  const offset = anchor.dx !== undefined || anchor.dy !== undefined
    ? `(${anchor.dx ?? 0},${anchor.dy ?? 0})`
    : '';
  return `${anchor.node}${offset}`;
}

function anchorFromUndulate(value: UndulateAnnotationAnchor): AnnotationAnchor {
  if (Array.isArray(value)) {
    const percent = value.some((part) => typeof part === 'string' && part.endsWith('%'));
    return {
      kind: 'point',
      x: Number(String(value[0]).replace('%', '')),
      y: Number(String(value[1]).replace('%', '')),
      ...(percent ? { percent: true } : {}),
    };
  }
  const match = value.match(/^([^()]+?)(?:\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*\))?$/);
  return {
    kind: 'node',
    node: match?.[1]?.trim() || value,
    ...(match?.[2] ? { dx: Number(match[2]) } : {}),
    ...(match?.[3] ? { dy: Number(match[3]) } : {}),
  };
}

export function toUndulateJSON(diagram: DiagramState): UndulateRoot {
  const root: UndulateRoot = toWavedromJSON(diagram);
  root.signal = mergeUndulateSignalEntries(diagram.signals, root.signal);
  const rows = buildRowLayout(diagram.signals);
  const annotations: UndulateAnnotation[] = [];

  for (const annotation of diagram.annotations ?? []) {
    if (annotation.type === 'arrow') {
      annotations.push({
        shape: annotation.shape,
        from: anchorToUndulate(annotation.from),
        to: anchorToUndulate(annotation.to),
        ...(annotation.text !== undefined ? { text: annotation.text } : {}),
        ...(annotation.dx !== undefined ? { dx: annotation.dx } : {}),
        ...(annotation.dy !== undefined ? { dy: annotation.dy } : {}),
        ...annotationStyleToUndulate(annotation.style),
      });
    } else if (
      annotation.type === 'vertical-line'
      || annotation.type === 'global-compression'
    ) {
      if (annotation.type === 'vertical-line') {
        annotations.push({
          shape: '|',
          x: annotationXCells(annotation),
          ...annotationRangesToUndulate(annotation),
          ...annotationStyleToUndulate(annotation.style),
        });
      } else {
        annotations.push({
          shape: '||',
          x: annotationXCells(annotation),
          ...annotationRangesToUndulate(annotation),
          ...annotationStyleToUndulate(annotation.style),
        });
      }
    } else {
      const logicalY = annotationYLogical(annotation, rows);
      if (logicalY === null) continue;
      if (annotation.type === 'horizontal-line') {
        annotations.push({
          shape: '-',
          y: logicalY / ROW_HEIGHT,
          ...annotationRangesToUndulate(annotation),
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

function expandedDigitalRoot(root: UndulateRoot): UndulateRoot {
  const clone = JSON.parse(JSON.stringify(root)) as UndulateRoot;
  const walk = (entries: WdSignalEntry[]) => {
    for (const entry of entries) {
      if (Array.isArray(entry)) {
        walk(entry.slice(1) as WdSignalEntry[]);
        continue;
      }
      const signal = entry as WdSignal;
      if (Array.isArray(signal.analogue) || typeof signal.wave !== 'string') continue;
      const repeat = Number.isInteger(signal.repeat) && (signal.repeat ?? 1) > 0
        ? signal.repeat!
        : 1;
      signal.wave = signal.wave.repeat(repeat);
      delete signal.repeat;
    }
  };
  walk(clone.signal);
  return clone;
}

function timingValues(rawSignals: WdSignal[]): number[] {
  const values: number[] = [];
  for (const raw of rawSignals) {
    if (Array.isArray(raw.analogue)) continue;
    if (typeof raw.phase === 'number') values.push(raw.phase);
    if (typeof raw.period === 'number') values.push(raw.period);
    if (Array.isArray(raw.periods)) values.push(...raw.periods);
    const count = (raw.wave?.length ?? 0)
      * (typeof raw.repeat === 'number' ? raw.repeat : 1);
    for (let index = 0; index < count; index++) {
      const period = raw.periods?.[index] ?? raw.period ?? 1;
      const duty = raw.duty_cycles?.[index] ?? raw.duty_cycle;
      if (duty !== undefined) values.push(period * duty);
    }
  }
  return values;
}

function importDigitalTiming(
  raw: WdSignal,
  parsed: Signal,
  ticksPerStep: number,
): void {
  if (parsed.type !== 'bit' || Array.isArray(raw.analogue)) return;
  const hasFineTiming =
    raw.repeat !== undefined
    || raw.periods !== undefined
    || raw.duty_cycle !== undefined
    || raw.duty_cycles !== undefined
    || raw.slewing !== undefined
    || (raw.period !== undefined && !Number.isInteger(raw.period))
    || (raw.phase !== undefined && !Number.isInteger(raw.phase));
  if (!hasFineTiming) return;
  parsed.digitalTiming = timingForStates(parsed.states, ticksPerStep, {
    phase: raw.phase,
    period: raw.period,
    periods: raw.periods,
    dutyCycle: raw.duty_cycle,
    dutyCycles: raw.duty_cycles,
    slewing: raw.slewing,
  });
  delete parsed.period;
  delete parsed.phase;
}

export function fromUndulateJSON(root: UndulateRoot): DiagramState {
  const diagram = fromWavedromJSON(expandedDigitalRoot(root));
  const rawSignals = flattenRawSignals(root.signal);
  const parsedSignals = flattenDiagramSignals(diagram.signals);
  const ticksPerStep = timingResolution(timingValues(rawSignals));
  rawSignals.forEach((raw, index) => {
    const parsed = parsedSignals[index];
    if (parsed) {
      importAnalogueSignal(raw, parsed);
      importDigitalTiming(raw, parsed, ticksPerStep);
    }
  });
  diagram.config.ticksPerStep = ticksPerStep;
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
      && 'x' in annotation
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
        ...(annotationRangeFromUndulate(annotation.from)
          ? { rangeFrom: annotationRangeFromUndulate(annotation.from) }
          : {}),
        ...(annotationRangeFromUndulate(annotation.to)
          ? { rangeTo: annotationRangeFromUndulate(annotation.to) }
          : {}),
        ...(style ? { style } : {}),
      };
    }
    if ('shape' in annotation && annotation.shape === '-' && 'y' in annotation) {
      const base: HorizontalLineAnnotation = {
        id: nanoid(),
        type: 'horizontal-line',
        y: annotation.y,
        coordinateMode: 'diagram',
        ...(annotationRangeFromUndulate(annotation.from)
          ? { rangeFrom: annotationRangeFromUndulate(annotation.from) }
          : {}),
        ...(annotationRangeFromUndulate(annotation.to)
          ? { rangeTo: annotationRangeFromUndulate(annotation.to) }
          : {}),
        ...(style ? { style } : {}),
      };
      return base;
    }
    if (
      'shape' in annotation
      && annotation.shape !== '|'
      && annotation.shape !== '||'
      && annotation.shape !== '-'
      && 'from' in annotation
      && 'to' in annotation
      && typeof annotation.from !== 'number'
      && typeof annotation.to !== 'number'
    ) {
      const arrow = annotation as import('./types').UndulateArrowAnnotation;
      return {
        id: nanoid(),
        type: 'arrow',
        shape: annotation.shape,
        from: anchorFromUndulate(arrow.from),
        to: anchorFromUndulate(arrow.to),
        ...(arrow.text !== undefined ? { text: arrow.text } : {}),
        ...(arrow.dx !== undefined ? { dx: arrow.dx } : {}),
        ...(arrow.dy !== undefined ? { dy: arrow.dy } : {}),
        ...(style ? { style } : {}),
      };
    }
    if (!('x' in annotation) || !('y' in annotation) || !('text' in annotation)) {
      throw new Error('Invalid Undulate annotation');
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
        || parsedSignals.some(
          (signal) => signal.type === 'analogue' || signal.digitalTiming !== undefined,
        ),
      sourceFormat: 'undulate-json',
      sourceRevision: UNDULATE_TARGET_REVISION,
    },
    annotations,
  });
}
