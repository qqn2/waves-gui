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
import {
  DEFAULT_ANALOGUE_CONTEXT,
  evaluateAnalogueCurve,
  evaluateAnalogueScalar,
  type AnalogueContext,
} from '../shared/analogueExpressions';
import {
  documentDurationTicks,
  durationTicksToSteps,
  timingForCellCount,
  timingForStates,
  timingResolution,
} from '../shared/fineTiming';
import {
  normalizeUndulateColor,
  parseAnnotationFontFamily,
  parseAnnotationFontSize,
  parseAnnotationFontWeight,
} from '../shared/annotations';
import {
  signalStyleFromUndulate,
  signalStyleToUndulate,
} from '../shared/signalStyles';
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
  SignalTiming,
  VerticalLineAnnotation,
} from '../shared/types';
import {
  encodeWaveString,
  fromWavedromJSON,
  toWavedromJSON,
} from '../wavedromBridge';
import { segmentsToWaveAndData } from '../shared/vectorSegments';
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
import {
  UNDULATE_PROPERTY_MANIFEST,
  UNDULATE_TARGET_REVISION,
} from './validation';
import {
  normalizeUndulateEdge,
  wavedromEdgeToUndulate,
} from './edges';
import {
  nodeToUndulate,
  parseUndulateNodes,
  wavedromNodePattern,
} from './nodes';

const ROOT_FIELDS = new Set([
  ...UNDULATE_PROPERTY_MANIFEST.root.supported,
  ...UNDULATE_PROPERTY_MANIFEST.root.unsupportedByDesign,
]);
/** Modeled fields only — opaque-listed properties must remain outside this set. */
const DIGITAL_FIELDS = new Set([
  ...UNDULATE_PROPERTY_MANIFEST.digitalSignal.supported,
]);
const ANALOGUE_FIELDS = new Set([
  ...UNDULATE_PROPERTY_MANIFEST.analogueSignal.supported,
]);
const CONFIG_FIELDS = new Set([
  ...UNDULATE_PROPERTY_MANIFEST.config.supported,
]);
const ANNOTATION_FIELDS = new Set([
  ...UNDULATE_PROPERTY_MANIFEST.annotation.supported,
]);
const HEAD_FIELDS = new Set<string>(UNDULATE_PROPERTY_MANIFEST.head.supported);
const FOOT_FIELDS = new Set<string>(UNDULATE_PROPERTY_MANIFEST.foot.supported);

function opaqueFields(
  value: Record<string, unknown>,
  known: ReadonlySet<string>,
): Record<string, unknown> | undefined {
  const entries = Object.entries(value).filter(([field]) => !known.has(field));
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
}

function withOpaqueFields(
  entry: WdSignal,
  signal: Signal,
  opaqueSignals: Record<string, Record<string, unknown>> | undefined,
): WdSignal {
  return { ...(opaqueSignals?.[signal.id] ?? {}), ...entry } as WdSignal;
}

function retainCompactDigitalRepeat(entry: WdSignal, signal: Signal): WdSignal {
  const source = signal.undulateRepeat;
  if (
    source
    && signal.type !== 'analogue'
    && signal.states.length === source.states.length
    && signal.states.every((state, index) => state === source.states[index])
  ) {
    return { ...entry, wave: source.wave, repeat: source.repeat };
  }
  const expanded = { ...entry };
  delete expanded.repeat;
  return expanded;
}

function opaqueNamedObject(
  value: unknown,
  known: ReadonlySet<string>,
): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? opaqueFields(value as Record<string, unknown>, known)
    : undefined;
}

function mergeOpaqueNamedObject(
  opaque: unknown,
  known: unknown,
): Record<string, unknown> | undefined {
  const opaqueRecord =
    opaque && typeof opaque === 'object' && !Array.isArray(opaque)
      ? opaque as Record<string, unknown>
      : undefined;
  const knownRecord =
    known && typeof known === 'object' && !Array.isArray(known)
      ? known as Record<string, unknown>
      : undefined;
  return opaqueRecord || knownRecord
    ? { ...(opaqueRecord ?? {}), ...(knownRecord ?? {}) }
    : undefined;
}

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
    ...(style.fontSize !== undefined
      ? { 'font-size': `${style.fontSize}px` }
      : {}),
    ...(style.fontFamily !== undefined ? { font: style.fontFamily } : {}),
    ...(style.fontWeight !== undefined
      ? { 'font-weight': style.fontWeight }
      : {}),
    ...(style.textBackground !== undefined
      ? { text_background: style.textBackground }
      : {}),
  };
}

function annotationStyleFromUndulate(
  annotation: Record<string, unknown>,
): AnnotationStyle | undefined {
  const style: AnnotationStyle = {};
  const fill = normalizeUndulateColor(annotation.fill);
  const stroke = normalizeUndulateColor(annotation.stroke)
    ?? normalizeUndulateColor(annotation.color);
  if (fill !== undefined) style.fill = fill;
  if (stroke !== undefined) style.stroke = stroke;
  if (typeof annotation['stroke-width'] === 'number') {
    style.strokeWidth = annotation['stroke-width'];
  }
  if (Array.isArray(annotation['stroke-dasharray'])) {
    style.strokeDasharray = annotation['stroke-dasharray'] as number[];
  }
  const fontSize = parseAnnotationFontSize(annotation['font-size']);
  if (fontSize !== undefined) style.fontSize = fontSize;
  const fontFamily = parseAnnotationFontFamily(annotation.font);
  if (fontFamily !== undefined) style.fontFamily = fontFamily;
  const fontWeight = parseAnnotationFontWeight(annotation['font-weight']);
  if (fontWeight !== undefined) style.fontWeight = fontWeight;
  if (typeof annotation.text_background === 'boolean') {
    style.textBackground = annotation.text_background;
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

function analogueCellsFingerprint(cells: AnalogueCell[]): string {
  return JSON.stringify(cells.map((cell) => ({
    kind: cell.kind,
    value: cell.value,
    ...(cell.samples ? {
      samples: cell.samples.map(({ offset, value }) => [offset, value]),
    } : {}),
    ...(cell.sampleTimebase ? { sampleTimebase: cell.sampleTimebase } : {}),
    ...(cell.expression ? { expression: cell.expression } : {}),
  })));
}

function analogueToUndulateEntry(
  signal: Signal,
  preserveExpressions: boolean,
): WdSignal {
  const cells = signal.analogueCells ?? [];
  const values: UndulateAnalogueValue[] = [];
  const wave = cells.map((cell, index) => {
    if (cell.kind === 'samples') {
      values.push(
        cell.expression && preserveExpressions
          ? cell.expression
          : (cell.samples ?? []).map((point) => {
              const timebase = cell.sampleTimebase;
              const time = timebase
                ? timebase.start + point.offset * (timebase.end - timebase.start)
                : point.offset;
              return [time, point.value];
            }),
      );
      return 'a';
    }
    if (cell.kind === 'capacitive') {
      values.push(
        cell.expression && preserveExpressions
          ? cell.expression
          : cell.value,
      );
      return 'c';
    }
    if (cell.kind === 'step') {
      values.push(
        cell.expression && preserveExpressions
          ? cell.expression
          : cell.value,
      );
      return 's';
    }
    if (cell.kind === 'metastable-low') return 'm';
    if (cell.kind === 'metastable-high') return 'M';
    if (cell.kind === 'impulse-low') return 'i';
    if (cell.kind === 'impulse-high') return 'I';
    if (index === 0) {
      const midpoint =
        ((signal.analogueMin ?? DEFAULT_ANALOGUE_MIN)
          + (signal.analogueMax ?? DEFAULT_ANALOGUE_MAX)) / 2;
      return cell.value <= midpoint ? '0' : '1';
    }
    return '.';
  }).join('');
  const expanded: WdSignal = {
    name: signal.name,
    wave,
    analogue: values,
    ...(nodeToUndulate(signal) !== undefined
      ? { node: nodeToUndulate(signal) }
      : {}),
    ...(signal.slewing !== undefined ? { slewing: signal.slewing } : {}),
    ...(signal.vscale !== undefined ? { vscale: signal.vscale } : {}),
    ...(signal.overlay !== undefined ? { overlay: signal.overlay } : {}),
    ...(signal.order !== undefined ? { order: signal.order } : {}),
    ...signalStyleToUndulate(signal.style),
  };
  const source = signal.undulateAnalogueRepeat;
  return source && source.fingerprint === analogueCellsFingerprint(cells)
    ? {
        ...expanded,
        wave: source.wave,
        analogue: JSON.parse(JSON.stringify(source.analogue)) as unknown[],
        repeat: source.repeat,
      }
    : expanded;
}

function applyTimingFields(entry: WdSignal, timing: SignalTiming): WdSignal {
  const periods = timing.cells.map(
    (cell) => cell.durationTicks / timing.ticksPerStep,
  );
  const hasExplicitPeriod = timing.sourceFields?.period === true;
  delete entry.period;
  delete entry.periods;
  if (
    periods.length > 0
    && (hasExplicitPeriod || periods.some((value) => value !== 1))
    && periods.every((value) => value === periods[0])
  ) {
    entry.period = periods[0];
  } else if (periods.some((value) => value !== 1)) {
    entry.periods = periods;
  }

  const dutyCycles = timing.cells.map((cell) =>
    cell.dutyTicks === undefined ? 0.5 : cell.dutyTicks / cell.durationTicks,
  );
  const hasExplicitDuty = timing.sourceFields?.dutyCycle === true;
  delete entry.duty_cycle;
  delete entry.duty_cycles;
  if (hasExplicitDuty || dutyCycles.some((value) => value !== 0.5)) {
    if (dutyCycles.every((value) => value === dutyCycles[0])) {
      entry.duty_cycle = dutyCycles[0];
    } else {
      entry.duty_cycles = dutyCycles;
    }
  }

  const phase = timing.phaseTicks / timing.ticksPerStep;
  if (phase !== 0 || timing.sourceFields?.phase === true) {
    entry.phase = phase;
  } else {
    delete entry.phase;
  }
  if (timing.slewing !== undefined) entry.slewing = timing.slewing;
  else delete entry.slewing;
  return entry;
}

function vectorToUndulateEntry(signal: Signal): WdSignal {
  const totalSteps = Math.max(
    1,
    signal.vectorTiming?.cells.length ?? 0,
    signal.stepGaps?.length ?? 0,
    signal.segments.reduce((end, segment) => Math.max(end, segment.endStep), 0),
  );
  const { wave, data } = segmentsToWaveAndData(
    signal.segments,
    totalSteps,
    signal.stepGaps,
  );
  const entry: WdSignal = {
    name: signal.name,
    wave,
    data,
    ...(signal.phase !== undefined ? { phase: signal.phase } : {}),
    ...(signal.period !== undefined ? { period: signal.period } : {}),
    ...(nodeToUndulate(signal) !== undefined
      ? { node: nodeToUndulate(signal) }
      : {}),
    ...signalStyleToUndulate(signal.style),
  };
  return signal.vectorTiming
    ? applyTimingFields(entry, signal.vectorTiming)
    : entry;
}

function mergeUndulateSignalEntries(
  signals: SignalOrGroup[],
  sharedEntries: WdSignalEntry[],
  context: AnalogueContext,
  preserveExpressions: boolean,
  opaqueSignals?: Record<string, Record<string, unknown>>,
): WdSignalEntry[] {
  return signals.map((signal, index) => {
    const shared = sharedEntries[index] ?? {};
    if (signal.type === 'group') {
      const sharedChildren =
        Array.isArray(shared) ? shared.slice(1) as WdSignalEntry[] : [];
      return [
        signal.name,
        ...mergeUndulateSignalEntries(
          signal.children,
          sharedChildren,
          context,
          preserveExpressions,
          opaqueSignals,
        ),
      ] as WdGroup;
    }
    if (signal.type === 'analogue') {
      return withOpaqueFields(
        analogueToUndulateEntry(signal, preserveExpressions),
        signal,
        opaqueSignals,
      );
    }
    if (signal.type === 'vector') {
      return withOpaqueFields(
        vectorToUndulateEntry(signal),
        signal,
        opaqueSignals,
      );
    }
    if (signal.type === 'bit' && signal.digitalTiming) {
      const timing = signal.digitalTiming;
      const entry = { ...(shared as WdSignal) };
      // Do not take the timed wave from toWavedromJSON(): that bridge pads to
      // the document's major grid and would truncate a native fine-timed lane.
      entry.wave = encodeWaveString(
        timing.cells.map((cell) => cell.state),
        signal.stepGaps,
        signal.stepGlitches,
      );
      applyTimingFields(entry, timing);
      delete entry.repeat;
      return withOpaqueFields(
        retainCompactDigitalRepeat(
          {
            ...withUndulateNode(entry, signal),
            ...signalStyleToUndulate(signal.style),
          },
          signal,
        ),
        signal,
        opaqueSignals,
      );
    }
    return withOpaqueFields(
      retainCompactDigitalRepeat(
        {
          ...withUndulateNode({ ...(shared as WdSignal) }, signal),
          ...signalStyleToUndulate(signal.style),
        },
        signal,
      ),
      signal,
      opaqueSignals,
    );
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

function withUndulateNode(entry: WdSignal, signal: Signal): WdSignal {
  const node = nodeToUndulate(signal);
  return {
    ...entry,
    ...(node !== undefined ? { node } : {}),
  };
}

export function toUndulateJSON(
  diagram: DiagramState,
  options: { includeAppMetadata?: boolean } = {},
): UndulateRoot {
  const includeAppMetadata = options.includeAppMetadata !== false;
  let root: UndulateRoot = toWavedromJSON(diagram);
  const opaque = diagram.compatibility?.opaqueUndulate;
  // Object spread defines "__proto__" as data instead of invoking its legacy
  // setter. Validation rejects that key, but keep export safe for direct API use.
  root = { ...(opaque?.root ?? {}), ...root };
  const mergedConfig = mergeOpaqueNamedObject(opaque?.config, root.config);
  if (mergedConfig) {
    const opaqueConfig = opaque?.config;
    mergedConfig.head = mergeOpaqueNamedObject(
      opaqueConfig?.head,
      (root.config as Record<string, unknown> | undefined)?.head,
    );
    mergedConfig.foot = mergeOpaqueNamedObject(
      opaqueConfig?.foot,
      (root.config as Record<string, unknown> | undefined)?.foot,
    );
    if (mergedConfig.head === undefined) delete mergedConfig.head;
    if (mergedConfig.foot === undefined) delete mergedConfig.foot;
    root.config = mergedConfig;
  }
  const mergedHead = mergeOpaqueNamedObject(opaque?.head, root.head);
  const mergedFoot = mergeOpaqueNamedObject(opaque?.foot, root.foot);
  if (mergedHead) root.head = mergedHead;
  if (mergedFoot) root.foot = mergedFoot;
  if (root.edge && root.edge.length > 0) {
    const fromWavedrom =
      diagram.compatibility?.sourceFormat === 'wavedrom-json';
    root.edges = root.edge.map(
      (edge) => wavedromEdgeToUndulate(edge, fromWavedrom) ?? edge,
    );
    delete root.edge;
  }
  root.signal = mergeUndulateSignalEntries(
    diagram.signals,
    root.signal,
    diagram.config.analogueContext ?? DEFAULT_ANALOGUE_CONTEXT,
    includeAppMetadata,
    diagram.compatibility?.opaqueUndulate?.signals,
  );
  const rows = buildRowLayout(diagram.signals);
  const annotations: UndulateAnnotation[] = [];
  const addAnnotation = (
    annotationId: string,
    value: UndulateAnnotation,
  ) => {
    annotations.push({
      ...(opaque?.annotations?.[annotationId] ?? {}),
      ...value,
    } as UndulateAnnotation);
  };

  for (const annotation of diagram.annotations ?? []) {
    if (annotation.type === 'arrow') {
      addAnnotation(annotation.id, {
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
        addAnnotation(annotation.id, {
          shape: '|',
          x: annotationXCells(annotation),
          ...annotationRangesToUndulate(annotation),
          ...annotationStyleToUndulate(annotation.style),
        });
      } else {
        addAnnotation(annotation.id, {
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
        addAnnotation(annotation.id, {
          shape: '-',
          y: logicalY / ROW_HEIGHT,
          ...annotationRangesToUndulate(annotation),
          ...annotationStyleToUndulate(annotation.style),
        });
      } else {
        addAnnotation(annotation.id, {
          text: annotation.text,
          x: annotationXCells(annotation),
          y: logicalY / ROW_HEIGHT,
          ...annotationStyleToUndulate(annotation.style),
        });
      }
    }
  }
  if (annotations.length > 0) root.annotations = annotations;
  if (
    includeAppMetadata
    && (
      diagram.config.analogueContext !== undefined
      || diagram.config.analogueRandomSeed !== undefined
    )
  ) {
    root['x-waves-gui'] = {
      ...(diagram.config.analogueContext !== undefined
        ? { analogueContext: { ...diagram.config.analogueContext } }
        : {}),
      ...(diagram.config.analogueRandomSeed !== undefined
        ? { randomSeed: diagram.config.analogueRandomSeed >>> 0 }
        : {}),
    };
  } else {
    delete root['x-waves-gui'];
  }
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
  expression?: string,
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
    ...(
      minTime !== 0 || maxTime !== 1
        ? { sampleTimebase: { start: minTime, end: maxTime } }
        : {}
    ),
    ...(expression ? { expression } : {}),
  };
}

function importAnalogueSignal(
  raw: WdSignal,
  parsed: Signal,
  context: AnalogueContext,
  randomSeed?: number,
): boolean {
  if (!Array.isArray(raw.analogue) || typeof raw.wave !== 'string') return false;
  const repeat = typeof raw.repeat === 'number' ? raw.repeat : 1;
  const wave = raw.wave.repeat(repeat);
  const values = raw.analogue as UndulateAnalogueValue[];
  const min = context.vssa;
  const max = context.vdda;
  let importedExpression = false;
  let valueIndex = 0;
  let previous = min;
  const cells: AnalogueCell[] = [];
  for (const char of wave) {
    let cell: AnalogueCell;
    if (char === 's' || char === 'c') {
      const source = values[valueIndex++ % values.length];
      const expression = typeof source === 'string' ? source : undefined;
      const value = expression
        ? evaluateAnalogueScalar(expression, context, {}, randomSeed)
        : source as number;
      importedExpression ||= expression !== undefined;
      cell = {
        id: nanoid(),
        kind: char === 's' ? 'step' : 'capacitive',
        value,
        ...(expression ? { expression } : {}),
      };
    } else if (char === 'a') {
      const source = values[valueIndex++ % values.length];
      if (typeof source === 'string') {
        cell = sampledCell(
          evaluateAnalogueCurve(source, context, randomSeed),
          previous,
          source,
        );
        importedExpression = true;
      } else {
        cell = sampledCell(source as Array<[number, number]>, previous);
      }
    } else if (char === 'm' || char === 'M' || char === 'i' || char === 'I') {
      const kind: AnalogueCell['kind'] =
        char === 'm'
          ? 'metastable-low'
          : char === 'M'
            ? 'metastable-high'
            : char === 'i'
              ? 'impulse-low'
              : 'impulse-high';
      const value =
        kind === 'metastable-low' || kind === 'impulse-high'
          ? min
          : max;
      cell = { id: nanoid(), kind, value };
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
  return importedExpression;
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
      if (typeof signal.node === 'string') {
        signal.node = wavedromNodePattern(signal.node);
      }
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

function importExpandedNodes(raw: WdSignal, parsed: Signal): void {
  if (typeof raw.node !== 'string') return;
  const expanded = parseUndulateNodes(raw.node);
  if (!expanded || Object.keys(expanded.namesByStep).length === 0) return;
  parsed.nodeNames = expanded.namesByStep;
}

function wavedromCompatibleRoot(root: UndulateRoot): UndulateRoot {
  const clone = expandedDigitalRoot(root);
  if (clone.edges) {
    clone.edge = clone.edges.map((edge) => normalizeUndulateEdge(edge) ?? edge);
    delete clone.edges;
  } else if (clone.edge) {
    clone.edge = clone.edge.map((edge) => normalizeUndulateEdge(edge) ?? edge);
  }
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

/**
 * A native timing document needs source-cell preservation across sibling
 * lanes. Shared WaveDrom-only documents retain the longstanding padded
 * canonical form instead.
 */
function hasNativeTimingFields(raw: WdSignal): boolean {
  return raw.repeat !== undefined
    || raw.periods !== undefined
    || raw.duty_cycle !== undefined
    || raw.duty_cycles !== undefined
    || raw.slewing !== undefined
    // An explicitly authored timing field is native even when its value is an
    // integer.  `period: 2`, for example, changes a two-cell waveform's
    // duration from two major steps to four; treating it as an ordinary
    // WaveDrom lane would lose both that extent and Draw-mode timing.
    || raw.period !== undefined
    || raw.phase !== undefined;
}

function importDigitalTiming(
  raw: WdSignal,
  parsed: Signal,
  ticksPerStep: number,
  preserveNativeCellCounts: boolean,
): void {
  if (
    (parsed.type !== 'bit' && parsed.type !== 'vector')
    || Array.isArray(raw.analogue)
  ) return;
  if (!preserveNativeCellCounts && !hasNativeTimingFields(raw)) return;
  // Every native digital lane keeps its source cells. This is what lets a
  // coarse sibling remain four cells wide beside an eight-cell half-period
  // lane without WaveDrom's generic padding changing either source shape.
  const timingOptions = {
    phase: raw.phase,
    period: raw.period,
    periods: raw.periods,
    dutyCycle: raw.duty_cycle,
    dutyCycles: raw.duty_cycles,
    slewing: raw.slewing,
    sourceFields: {
      ...(raw.period !== undefined || raw.periods !== undefined
        ? { period: true }
        : {}),
      ...(raw.phase !== undefined ? { phase: true } : {}),
      ...(raw.duty_cycle !== undefined || raw.duty_cycles !== undefined
        ? { dutyCycle: true }
        : {}),
    },
  };
  if (parsed.type === 'bit') {
    parsed.digitalTiming = timingForStates(
      parsed.states,
      ticksPerStep,
      timingOptions,
    );
  } else {
    const repeat = Number.isInteger(raw.repeat) && raw.repeat! > 0
      ? raw.repeat!
      : 1;
    const cells = Math.max(
      1,
      (raw.wave?.length ?? Math.max(
        parsed.stepGaps?.length ?? 0,
        ...parsed.segments.map((segment) => segment.endStep),
      )) * repeat,
    );
    parsed.vectorTiming = timingForCellCount(cells, ticksPerStep, timingOptions);
  }
  delete parsed.period;
  delete parsed.phase;
}

export function fromUndulateJSON(root: UndulateRoot): DiagramState {
  const rawSignals = flattenRawSignals(root.signal);
  const preserveNativeCellCounts = rawSignals.some(hasNativeTimingFields);
  const diagram = fromWavedromJSON(wavedromCompatibleRoot(root), {
    padSignals: !preserveNativeCellCounts,
  });
  const parsedSignals = flattenDiagramSignals(diagram.signals);
  const ticksPerStep = timingResolution(timingValues(rawSignals));
  if (ticksPerStep === null) {
    throw new Error('Undulate timing exceeds the 1024-tick lossless resolution limit.');
  }
  const appMetadata = root['x-waves-gui'];
  const metadataContext = appMetadata?.analogueContext;
  const analogueContext: AnalogueContext =
    metadataContext
    && Number.isFinite(metadataContext.vssa)
    && Number.isFinite(metadataContext.vdda)
    && metadataContext.vdda > metadataContext.vssa
      ? { vssa: metadataContext.vssa, vdda: metadataContext.vdda }
      : { ...DEFAULT_ANALOGUE_CONTEXT };
  const randomSeed =
    Number.isInteger(appMetadata?.randomSeed)
      ? appMetadata!.randomSeed! >>> 0
      : undefined;
  let hasAnalogueExpression = false;
  const opaqueSignals: Record<string, Record<string, unknown>> = {};
  rawSignals.forEach((raw, index) => {
    const parsed = parsedSignals[index];
    if (parsed) {
      hasAnalogueExpression =
        importAnalogueSignal(raw, parsed, analogueContext, randomSeed)
        || hasAnalogueExpression;
      importDigitalTiming(
        raw,
        parsed,
        ticksPerStep,
        preserveNativeCellCounts,
      );
      importExpandedNodes(raw, parsed);
      parsed.style = signalStyleFromUndulate(
        raw as unknown as Record<string, unknown>,
      );
      if (
        !Array.isArray(raw.analogue)
        && typeof raw.wave === 'string'
        && typeof raw.repeat === 'number'
        && raw.repeat > 1
      ) {
        parsed.undulateRepeat = {
          repeat: raw.repeat,
          wave: raw.wave,
          states: [...parsed.states],
        };
      }
      if (
        Array.isArray(raw.analogue)
        && typeof raw.wave === 'string'
        && typeof raw.repeat === 'number'
        && raw.repeat > 1
      ) {
        parsed.undulateAnalogueRepeat = {
          repeat: raw.repeat,
          wave: raw.wave,
          analogue: JSON.parse(JSON.stringify(raw.analogue)) as unknown[],
          fingerprint: analogueCellsFingerprint(parsed.analogueCells ?? []),
        };
      }
      const opaque = opaqueFields(
        raw as unknown as Record<string, unknown>,
        Array.isArray(raw.analogue) ? ANALOGUE_FIELDS : DIGITAL_FIELDS,
      );
      if (opaque) opaqueSignals[parsed.id] = opaque;
    }
  });
  const opaqueRoot = opaqueFields(root as unknown as Record<string, unknown>, ROOT_FIELDS);
  const rawConfig =
    root.config && typeof root.config === 'object'
      ? root.config as Record<string, unknown>
      : undefined;
  const opaqueConfigFields = rawConfig
    ? opaqueFields(rawConfig, CONFIG_FIELDS)
    : undefined;
  const opaqueConfigHead = opaqueNamedObject(rawConfig?.head, HEAD_FIELDS);
  const opaqueConfigFoot = opaqueNamedObject(rawConfig?.foot, FOOT_FIELDS);
  const opaqueConfig =
    opaqueConfigFields || opaqueConfigHead || opaqueConfigFoot
      ? {
          ...(opaqueConfigFields ?? {}),
          ...(opaqueConfigHead ? { head: opaqueConfigHead } : {}),
          ...(opaqueConfigFoot ? { foot: opaqueConfigFoot } : {}),
        }
      : undefined;
  const opaqueHead = opaqueNamedObject(root.head, HEAD_FIELDS);
  const opaqueFoot = opaqueNamedObject(root.foot, FOOT_FIELDS);
  diagram.config.ticksPerStep = ticksPerStep;
  if (hasAnalogueExpression || metadataContext !== undefined) {
    diagram.config.analogueContext = analogueContext;
  }
  if (randomSeed !== undefined) diagram.config.analogueRandomSeed = randomSeed;
  diagram.config.totalSteps = Math.max(
    diagram.config.totalSteps,
    ...parsedSignals.map((signal) => signal.analogueCells?.length ?? 0),
  );
  if (preserveNativeCellCounts) {
    const nativeDurationTicks = documentDurationTicks(
      diagram.signals,
      ticksPerStep,
    );
    if (nativeDurationTicks > 0) {
      diagram.config.totalSteps = durationTicksToSteps(
        nativeDurationTicks,
        ticksPerStep,
      );
    }
  }
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
  const opaqueAnnotations: Record<string, Record<string, unknown>> = {};
  (root.annotations ?? []).forEach((raw, index) => {
    const parsed = annotations[index];
    const fields = opaqueFields(
      raw as unknown as Record<string, unknown>,
      ANNOTATION_FIELDS,
    );
    if (parsed && fields) opaqueAnnotations[parsed.id] = fields;
  });
  const hasOpaque =
    opaqueRoot !== undefined
    || opaqueConfig !== undefined
    || opaqueHead !== undefined
    || opaqueFoot !== undefined
    || Object.keys(opaqueSignals).length > 0
    || Object.keys(opaqueAnnotations).length > 0;

  return normalizeDiagram({
    ...diagram,
    version: 2,
    compatibility: {
      extensionsEnabled:
        annotations.length > 0
        || hasOpaque
        || appMetadata !== undefined
        || parsedSignals.some(
          (signal) =>
            signal.type === 'analogue'
            || signal.digitalTiming !== undefined
            || signal.vectorTiming !== undefined
            || signal.nodeNames !== undefined,
        ),
      sourceFormat: 'undulate-json',
      sourceRevision: UNDULATE_TARGET_REVISION,
      ...(
        hasOpaque
          ? {
              opaqueUndulate: {
                ...(opaqueRoot ? { root: opaqueRoot } : {}),
                ...(opaqueConfig ? { config: opaqueConfig } : {}),
                ...(opaqueHead ? { head: opaqueHead } : {}),
                ...(opaqueFoot ? { foot: opaqueFoot } : {}),
                ...(Object.keys(opaqueSignals).length > 0 ? { signals: opaqueSignals } : {}),
                ...(Object.keys(opaqueAnnotations).length > 0
                  ? { annotations: opaqueAnnotations }
                  : {}),
              },
            }
          : {}
      ),
    },
    annotations,
  });
}
