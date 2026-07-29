import {
  MAX_ANALOGUE_ABS_VALUE,
  MAX_ANALOGUE_SAMPLES_PER_CELL,
} from '../shared/analogue';
import { validateAnalogueExpression } from '../shared/analogueExpressions';
import {
  isSafeAnnotationColor,
  isSafeAnnotationDasharray,
  parseAnnotationFontSize,
  isSafeAnnotationStrokeWidth,
  MAX_ANNOTATIONS,
  MAX_ANNOTATION_COORDINATE,
  MAX_ANNOTATION_TEXT_LENGTH,
} from '../shared/annotations';
import { MAX_TICKS_PER_STEP, timingResolution } from '../shared/fineTiming';
import { validateWavedromJSON } from '../wavedromBridge';
import type { UndulateRoot } from './types';
import {
  hasUndulateOnlyEdgeMarker,
  normalizeUndulateEdge,
} from './edges';
import { parseUndulateNodes } from './nodes';

export const UNDULATE_TARGET_REVISION =
  'c8da7d48c48fc0bbc90113b6913611132bd96c01';

export type UndulateFindingKind =
  | 'wip'
  | 'unsupported-by-design'
  | 'invalid'
  | 'unknown'
  | 'opaque'
  | 'converted';

export interface UndulateFinding {
  kind: UndulateFindingKind;
  feature: string;
  path: string;
  message: string;
  sourceRevision: string;
  consequence?: string;
}

export const UNDULATE_PROPERTY_MANIFEST = {
  root: {
    supported: [
      'signal', 'config', 'head', 'foot', 'edge', 'edges', 'annotations',
    ],
    wip: [],
    unsupportedByDesign: ['reg', 'register'],
  },
  digitalSignal: {
    supported: [
      'name', 'wave', 'data', 'node', 'period', 'phase',
      'repeat', 'periods', 'duty_cycle', 'duty_cycles', 'slewing',
    ],
    wip: [
      'skin',
      'fill',
      'stroke',
      'stroke-width',
      'stroke-dasharray',
      'font-size',
      'font',
      'font-weight',
      'color',
    ],
  },
  analogueSignal: {
    supported: [
      'name',
      'wave',
      'analogue',
      'slewing',
      'vscale',
      'overlay',
      'order',
      'period',
      'phase',
      'node',
      'repeat',
    ],
    wip: [
      'periods',
      'duty_cycle',
      'duty_cycles',
      'skin',
      'fill',
      'stroke',
      'stroke-width',
      'stroke-dasharray',
      'font-size',
      'font',
      'font-weight',
      'color',
    ],
  },
  annotation: {
    supported: [
      'shape',
      'text',
      'x',
      'y',
      'fill',
      'stroke',
      'stroke-width',
      'stroke-dasharray',
      'from',
      'to',
      'dx',
      'dy',
      'font-size',
      'text_background',
    ],
    wip: [
      'font-weight',
      'color',
    ],
  },
  config: {
    supported: ['hscale', 'skin', 'head', 'foot'],
    wip: ['vscale', 'separation', 'no_ticks', 'gap-offset', 'ticks_phase'],
  },
} as const;

const ROOT_SUPPORTED = new Set<string>(UNDULATE_PROPERTY_MANIFEST.root.supported);
const ROOT_WIP = new Set<string>(UNDULATE_PROPERTY_MANIFEST.root.wip);
const ROOT_UNSUPPORTED = new Set<string>(
  UNDULATE_PROPERTY_MANIFEST.root.unsupportedByDesign,
);
const DIGITAL_SUPPORTED = new Set<string>(
  UNDULATE_PROPERTY_MANIFEST.digitalSignal.supported,
);
const DIGITAL_WIP = new Set<string>(UNDULATE_PROPERTY_MANIFEST.digitalSignal.wip);
const DIGITAL_EXTENSION_FIELDS = new Set([
  'repeat',
  'periods',
  'duty_cycle',
  'duty_cycles',
  'slewing',
]);
const ANALOGUE_SUPPORTED = new Set<string>(
  UNDULATE_PROPERTY_MANIFEST.analogueSignal.supported,
);
const ANALOGUE_WIP = new Set<string>(
  UNDULATE_PROPERTY_MANIFEST.analogueSignal.wip,
);
const ANNOTATION_SUPPORTED = new Set<string>(
  UNDULATE_PROPERTY_MANIFEST.annotation.supported,
);
const ANNOTATION_WIP = new Set<string>(
  UNDULATE_PROPERTY_MANIFEST.annotation.wip,
);

const CONFIG_SUPPORTED = new Set<string>(
  UNDULATE_PROPERTY_MANIFEST.config.supported,
);
const CONFIG_WIP = new Set<string>(UNDULATE_PROPERTY_MANIFEST.config.wip);
const HEAD_FIELDS = new Set(['text', 'tick', 'every']);
const FOOT_FIELDS = new Set(['text', 'tock', 'every']);
const EXTENDED_WAVE_FEATURES: ReadonlyArray<{
  pattern: RegExp;
  feature: string;
}> = [];

function finding(
  kind: UndulateFindingKind,
  feature: string,
  path: string,
  message: string,
  consequence?: string,
): UndulateFinding {
  return {
    kind,
    feature,
    path,
    message,
    sourceRevision: UNDULATE_TARGET_REVISION,
    ...(consequence ? { consequence } : {}),
  };
}

function wip(path: string, feature: string): UndulateFinding {
  return finding(
    'wip',
    feature,
    path,
    `[WIP] ${path} uses ${feature}, which is planned but not supported yet.`,
    'The current diagram was not changed.',
  );
}

function unknown(path: string): UndulateFinding {
  return finding(
    'unknown',
    'unknown property',
    path,
    `Unknown Undulate property ${path} for target revision ${UNDULATE_TARGET_REVISION}.`,
    'The property was not discarded and the current diagram was not changed.',
  );
}

function invalid(path: string, feature: string, detail: string): UndulateFinding {
  return finding(
    'invalid',
    feature,
    path,
    `Invalid ${path}: ${detail}.`,
    'The current diagram was not changed.',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const OPAQUE_MAX_DEPTH = 16;
const OPAQUE_MAX_NODES = 10_000;
const OPAQUE_MAX_STRING_LENGTH = 16_384;
const UNSAFE_OPAQUE_KEY = /^(?:__proto__|prototype|constructor|style|css|url|uri|href|src)$/i;
const UNSAFE_OPAQUE_TEXT = /(?:^|[\s"'(])(?:javascript|data|https?|file):/i;

/** Opaque data never reaches the renderer, but must remain bounded and declarative. */
function isSafeOpaqueValue(
  value: unknown,
  depth = 0,
  budget: { nodes: number } = { nodes: 0 },
): boolean {
  if (depth > OPAQUE_MAX_DEPTH || ++budget.nodes > OPAQUE_MAX_NODES) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') {
    return value.length <= OPAQUE_MAX_STRING_LENGTH && !UNSAFE_OPAQUE_TEXT.test(value);
  }
  if (Array.isArray(value)) {
    return value.length <= OPAQUE_MAX_NODES
      && value.every((item) => isSafeOpaqueValue(item, depth + 1, budget));
  }
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([key, item]) => (
    !UNSAFE_OPAQUE_KEY.test(key)
    && key.length <= 256
    && isSafeOpaqueValue(item, depth + 1, budget)
  ));
}

function scanUnknownFields(
  record: Record<string, unknown>,
  path: string,
  supported: ReadonlySet<string>,
  wipFields: ReadonlySet<string>,
  findings: UndulateFinding[],
): void {
  for (const field of Object.keys(record)) {
    const fieldPath = `${path}.${field}`;
    if (supported.has(field)) continue;
    if (wipFields.has(field)) {
      findings.push(wip(fieldPath, field.replaceAll('_', ' ')));
    } else {
      findings.push(isSafeOpaqueValue(record[field]) ? opaque(fieldPath) : unknown(fieldPath));
    }
  }
}

function scanNamedObject(
  value: unknown,
  path: string,
  knownFields: ReadonlySet<string>,
  findings: UndulateFinding[],
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    findings.push(invalid(path, path, 'must be an object'));
    return;
  }
  for (const field of Object.keys(value)) {
    if (!knownFields.has(field)) {
      findings.push(
        isSafeOpaqueValue(value[field])
          ? opaque(`${path}.${field}`)
          : unknown(`${path}.${field}`),
      );
    }
  }
}

function scanConfig(value: unknown, findings: UndulateFinding[]): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    findings.push(invalid('config', 'config', 'must be an object'));
    return;
  }
  scanUnknownFields(value, 'config', CONFIG_SUPPORTED, CONFIG_WIP, findings);
  scanNamedObject(value.head, 'config.head', HEAD_FIELDS, findings);
  scanNamedObject(value.foot, 'config.foot', FOOT_FIELDS, findings);
}

function scanAnalogueValues(
  signal: Record<string, unknown>,
  path: string,
  findings: UndulateFinding[],
): void {
  if (!Array.isArray(signal.analogue) || typeof signal.wave !== 'string') return;
  const consumingKinds = [...signal.wave].filter((char) => /[sca]/.test(char));
  signal.analogue.forEach((value, index) => {
    const valuePath = `${path}.analogue[${index}]`;
    if (typeof value === 'string') {
      const error = validateAnalogueExpression(
        value,
        consumingKinds[index] === 'a' ? 'curve' : 'scalar',
      );
      if (error) {
        findings.push(invalid(
          valuePath,
          'analogue expression',
          error,
        ));
      }
    }
  });
}

function scanSignal(
  signal: Record<string, unknown>,
  path: string,
  findings: UndulateFinding[],
): void {
  const analogue = Object.prototype.hasOwnProperty.call(signal, 'analogue');
  const supported = analogue ? ANALOGUE_SUPPORTED : DIGITAL_SUPPORTED;
  const wipFields = analogue ? ANALOGUE_WIP : DIGITAL_WIP;
  for (const field of Object.keys(signal)) {
    const fieldPath = `${path}.${field}`;
    if (wipFields.has(field)) {
      findings.push(wip(fieldPath, field.replaceAll('_', ' ')));
      continue;
    }
    if (!supported.has(field)) {
      findings.push(isSafeOpaqueValue(signal[field]) ? opaque(fieldPath) : unknown(fieldPath));
      continue;
    }
    if (field === 'wave' && typeof signal.wave === 'string' && !analogue) {
      for (const { pattern, feature } of EXTENDED_WAVE_FEATURES) {
        if (pattern.test(signal.wave)) findings.push(wip(fieldPath, feature));
      }
    } else if (field === 'analogue') {
      scanAnalogueValues(signal, path, findings);
    }
  }
}

function scanSignals(
  entries: unknown[],
  findings: UndulateFinding[],
  counter: { value: number },
): void {
  for (const entry of entries) {
    if (Array.isArray(entry)) {
      if (typeof entry[0] === 'string') {
        scanSignals(entry.slice(1), findings, counter);
      }
      continue;
    }
    if (!isRecord(entry) || Object.keys(entry).length === 0) continue;
    const path = `signal[${counter.value++}]`;
    scanSignal(entry, path, findings);
  }
}

function scanAnnotations(value: unknown, findings: UndulateFinding[]): void {
  if (value === undefined || !Array.isArray(value)) return;
  if (value.length > MAX_ANNOTATIONS) {
    findings.push(invalid(
      'annotations',
      'annotation count',
      `contains ${value.length} objects; the maximum is ${MAX_ANNOTATIONS}`,
    ));
  }
  value.forEach((annotation, index) => {
    if (!isRecord(annotation)) return;
    const path = `annotations[${index}]`;
    for (const field of Object.keys(annotation)) {
      const fieldPath = `${path}.${field}`;
      if (ANNOTATION_WIP.has(field)) {
        findings.push(wip(fieldPath, field.replaceAll('_', ' ')));
      } else if (!ANNOTATION_SUPPORTED.has(field)) {
        findings.push(
          isSafeOpaqueValue(annotation[field]) ? opaque(fieldPath) : unknown(fieldPath),
        );
      } else if (
        field === 'text'
        && typeof annotation.text === 'string'
        && annotation.text.length > MAX_ANNOTATION_TEXT_LENGTH
      ) {
        findings.push(invalid(
          fieldPath,
          'annotation text',
          `contains ${annotation.text.length} characters; the maximum is ${MAX_ANNOTATION_TEXT_LENGTH}`,
        ));
      }
    }
  });
}

function scanProperties(root: Record<string, unknown>): UndulateFinding[] {
  const findings: UndulateFinding[] = [];
  for (const field of Object.keys(root)) {
    if (ROOT_SUPPORTED.has(field)) {
      if (field === 'signal' && Array.isArray(root.signal)) {
        scanSignals(root.signal, findings, { value: 0 });
      } else if (field === 'config') {
        scanConfig(root.config, findings);
      } else if (field === 'head') {
        scanNamedObject(root.head, 'head', HEAD_FIELDS, findings);
      } else if (field === 'foot') {
        scanNamedObject(root.foot, 'foot', FOOT_FIELDS, findings);
      } else if (field === 'annotations') {
        scanAnnotations(root.annotations, findings);
      }
      continue;
    }
    if (ROOT_WIP.has(field)) {
      findings.push(wip(field, field === 'edges' ? 'plural Undulate edges' : field));
    } else if (ROOT_UNSUPPORTED.has(field)) {
      findings.push(finding(
        'unsupported-by-design',
        'register diagrams',
        field,
        'Unsupported by design: register diagrams are a separate diagram product outside this waveform editor.',
        'The current diagram was not changed.',
      ));
    } else {
      findings.push(isSafeOpaqueValue(root[field]) ? opaque(field) : unknown(field));
    }
  }
  return findings;
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
        && Math.abs(point[1]) <= MAX_ANALOGUE_ABS_VALUE
      ),
    )
  );
}

function validateAnalogueSignal(signal: Record<string, unknown>): string | null {
  if (signal.analogue === undefined) return null;
  if (!Array.isArray(signal.analogue)) return 'analogue must be an array';
  if (typeof signal.wave !== 'string') return 'analogue signal requires a wave string';
  if (
    signal.repeat !== undefined
    && (
      typeof signal.repeat !== 'number'
      || !Number.isInteger(signal.repeat)
      || signal.repeat < 1
      || signal.repeat > 10_000
    )
  ) {
    return 'analogue repeat must be an integer from 1 to 10000';
  }
  const consumingKinds = [...signal.wave].filter((char) => /[sca]/.test(char));
  if (consumingKinds.length !== signal.analogue.length) {
    return 'analogue value count must match s/c/a wave cells';
  }
  for (let index = 0; index < consumingKinds.length; index++) {
    const kind = consumingKinds[index]!;
    const value = signal.analogue[index];
    if (kind === 'a') {
      if (typeof value === 'string') {
        const error = validateAnalogueExpression(value, 'curve');
        if (error) return `analogue[${index}] expression is invalid: ${error}`;
        continue;
      }
      if (!isFinitePointList(value)) {
        return `analogue[${index}] requires a supported curve expression or 1 to ${MAX_ANALOGUE_SAMPLES_PER_CELL} finite [time, value] points within the supported voltage range`;
      }
      if (
        value.length > 1
        && (value[0]![0] !== 0 || value[value.length - 1]![0] !== 1)
      ) {
        return `analogue[${index}] sample times must already span 0 through 1; implicit time normalization is not lossless`;
      }
      if (value.length === 1 && value[0]![0] !== 0) {
        return `analogue[${index}] single sample time must be 0`;
      }
    } else if (typeof value === 'string') {
      const error = validateAnalogueExpression(value, 'scalar');
      if (error) return `analogue[${index}] expression is invalid: ${error}`;
      continue;
    } else if (
      typeof value !== 'number'
      || !Number.isFinite(value)
      || Math.abs(value) > MAX_ANALOGUE_ABS_VALUE
    ) {
      return `analogue[${index}] step/capacitive value must be a finite number within ±${MAX_ANALOGUE_ABS_VALUE}`;
    }
  }
  if (
    signal.slewing !== undefined
    && (
      typeof signal.slewing !== 'number'
      || !Number.isFinite(signal.slewing)
      || signal.slewing < 0
    )
  ) {
    return 'slewing must be a finite number greater than or equal to 0';
  }
  if (
    signal.vscale !== undefined
    && (
      typeof signal.vscale !== 'number'
      || !Number.isFinite(signal.vscale)
      || signal.vscale < 0.25
      || signal.vscale > 16
    )
  ) {
    return 'vscale must be a finite number from 0.25 to 16';
  }
  if (signal.overlay !== undefined && typeof signal.overlay !== 'boolean') {
    return 'overlay must be a boolean';
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
    return 'order must be an integer from 0 to 4';
  }
  return null;
}

function opaque(path: string): UndulateFinding {
  return finding(
    'opaque',
    'safe unknown property',
    path,
    `Preserving safe unknown Undulate property ${path} for target revision ${UNDULATE_TARGET_REVISION}.`,
    'The property is retained verbatim but is not interpreted by the editor.',
  );
}

function validateDigitalTiming(signal: Record<string, unknown>): string | null {
  if (signal.analogue !== undefined) return null;
  const repeat = signal.repeat ?? 1;
  if (
    typeof repeat !== 'number'
    || !Number.isInteger(repeat)
    || repeat < 1
    || repeat > 10_000
  ) {
    return 'repeat must be an integer from 1 to 10000';
  }
  const expandedLength = typeof signal.wave === 'string'
    ? signal.wave.length * repeat
    : 0;
  for (const field of ['periods', 'duty_cycles']) {
    const array = signal[field];
    if (array === undefined) continue;
    if (!Array.isArray(array) || array.length !== expandedLength) {
      return `${field} must contain exactly one value per expanded wave cell`;
    }
  }
  const periods = [
    ...(signal.period !== undefined ? [signal.period] : []),
    ...(Array.isArray(signal.periods) ? signal.periods : []),
  ];
  if (periods.some((value) =>
    typeof value !== 'number' || !Number.isFinite(value) || value <= 0
  )) {
    return 'period and periods must contain finite positive numbers';
  }
  const duties = [
    ...(signal.duty_cycle !== undefined ? [signal.duty_cycle] : []),
    ...(Array.isArray(signal.duty_cycles) ? signal.duty_cycles : []),
  ];
  if (duties.some((value) =>
    typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1
  )) {
    return 'duty_cycle and duty_cycles must contain finite values from 0 to 1';
  }
  if (
    signal.slewing !== undefined
    && (
      typeof signal.slewing !== 'number'
      || !Number.isFinite(signal.slewing)
      || signal.slewing < 0
    )
  ) {
    return 'slewing must be a finite number greater than or equal to 0';
  }
  const timingValues: number[] = [];
  if (typeof signal.phase === 'number') timingValues.push(signal.phase);
  if (typeof signal.period === 'number') timingValues.push(signal.period);
  if (Array.isArray(signal.periods)) timingValues.push(...signal.periods as number[]);
  for (let index = 0; index < expandedLength; index++) {
    const period = Array.isArray(signal.periods)
      ? signal.periods[index]
      : signal.period ?? 1;
    const duty = Array.isArray(signal.duty_cycles)
      ? signal.duty_cycles[index]
      : signal.duty_cycle;
    if (typeof period === 'number' && typeof duty === 'number') {
      timingValues.push(period * duty);
    }
  }
  if (timingResolution(timingValues) === null) {
    return `timing values require more than ${MAX_TICKS_PER_STEP} ticks per step and cannot be represented losslessly`;
  }
  return null;
}

function visitSignals(
  entries: unknown[],
  visit: (signal: Record<string, unknown>) => string | null,
): string | null {
  for (const entry of entries) {
    if (Array.isArray(entry) && typeof entry[0] === 'string') {
      const error = visitSignals(entry.slice(1), visit);
      if (error) return error;
    } else if (isRecord(entry) && Object.keys(entry).length > 0) {
      const error = visit(entry);
      if (error) return error;
    }
  }
  return null;
}

function waveDromValidationView(root: Record<string, unknown>): UndulateRoot {
  const clone = JSON.parse(JSON.stringify(root)) as UndulateRoot;
  if (Array.isArray(clone.signal)) {
    visitSignals(clone.signal, (signal) => {
      if (typeof signal.wave === 'string') {
        signal.wave = signal.wave.replace(/[sca mMlLhHiI]/g, '.');
      }
      return null;
    });
  }
  return clone;
}

function validateAnnotationStructure(value: unknown): string | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return 'annotations must be an array';
  for (let index = 0; index < value.length; index++) {
    const annotation = value[index];
    if (!isRecord(annotation)) return `annotations[${index}] must be an object`;
    for (const field of ['fill', 'stroke']) {
      if (
        annotation[field] !== undefined
        && !isSafeAnnotationColor(annotation[field])
      ) {
        return `annotations[${index}].${field} must be a safe hex, rgb(), or rgba() color`;
      }
    }
    if (
      annotation['stroke-width'] !== undefined
      && !isSafeAnnotationStrokeWidth(annotation['stroke-width'])
    ) {
      return `annotations[${index}].stroke-width must be a finite number from 0 to 32`;
    }
    if (
      annotation['stroke-dasharray'] !== undefined
      && !isSafeAnnotationDasharray(annotation['stroke-dasharray'])
    ) {
      return `annotations[${index}].stroke-dasharray must contain 1 to 16 finite values from 0 to 1000`;
    }
    if (
      annotation['font-size'] !== undefined
      && parseAnnotationFontSize(annotation['font-size']) === undefined
    ) {
      return `annotations[${index}].font-size must be a pixel size from 6px to 96px`;
    }
    if (
      annotation.text_background !== undefined
      && typeof annotation.text_background !== 'boolean'
    ) {
      return `annotations[${index}].text_background must be a boolean`;
    }
    if (
      annotation.shape === '|'
      || annotation.shape === '||'
      || annotation.shape === '-'
    ) {
      for (const field of ['from', 'to']) {
        const range = annotation[field];
        if (range === undefined) continue;
        const validIndex =
          typeof range === 'number'
          && Number.isFinite(range)
          && Math.abs(range) <= MAX_ANNOTATION_COORDINATE;
        const percent = typeof range === 'string'
          ? range.trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*%$/)
          : null;
        const validPercent = percent !== null
          && Number(percent[1]) >= 0
          && Number(percent[1]) <= 100;
        if (!validIndex && !validPercent) {
          return `annotations[${index}].${field} must be a finite index within ±${MAX_ANNOTATION_COORDINATE} or a percentage from 0% to 100%`;
        }
      }
    }
    if (annotation.shape === '|' || annotation.shape === '||') {
      if (
        typeof annotation.x !== 'number'
        || !Number.isFinite(annotation.x)
        || Math.abs(annotation.x) > MAX_ANNOTATION_COORDINATE
      ) {
        return `annotations[${index}] requires a finite x coordinate within ±${MAX_ANNOTATION_COORDINATE}`;
      }
      continue;
    }
    if (annotation.shape === '-') {
      if (
        typeof annotation.y !== 'number'
        || !Number.isFinite(annotation.y)
        || Math.abs(annotation.y) > MAX_ANNOTATION_COORDINATE
      ) {
        return `annotations[${index}] requires a finite y coordinate within ±${MAX_ANNOTATION_COORDINATE}`;
      }
      continue;
    }
    if (annotation.shape !== undefined) {
      const validAnchor = (anchor: unknown) => {
        if (typeof anchor === 'string') return anchor.trim().length > 0;
        return Array.isArray(anchor)
          && anchor.length === 2
          && anchor.every((part) => {
            if (typeof part === 'number') return Number.isFinite(part);
            return typeof part === 'string'
              && /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))%$/.test(part.trim());
          });
      };
      if (!validAnchor(annotation.from) || !validAnchor(annotation.to)) {
        return `annotations[${index}] arrow requires valid from and to anchors`;
      }
      for (const field of ['dx', 'dy']) {
        if (
          annotation[field] !== undefined
          && (typeof annotation[field] !== 'number'
            || !Number.isFinite(annotation[field]))
        ) {
          return `annotations[${index}].${field} must be finite`;
        }
      }
      continue;
    }
    if (typeof annotation.text !== 'string') {
      return `annotations[${index}] text annotation requires text`;
    }
    if (
      typeof annotation.x !== 'number'
      || !Number.isFinite(annotation.x)
      || Math.abs(annotation.x) > MAX_ANNOTATION_COORDINATE
      || typeof annotation.y !== 'number'
      || !Number.isFinite(annotation.y)
      || Math.abs(annotation.y) > MAX_ANNOTATION_COORDINATE
    ) {
      return `annotations[${index}] text annotation requires finite x and y coordinates within ±${MAX_ANNOTATION_COORDINATE}`;
    }
  }
  return null;
}

function structuralError(root: Record<string, unknown>): string | null {
  if (root.edge !== undefined && root.edges !== undefined) {
    return 'edge and edges cannot both be present';
  }
  for (const field of ['edge', 'edges'] as const) {
    const edges = root[field];
    if (edges === undefined) continue;
    if (!Array.isArray(edges)) return `${field} must be an array`;
    for (let index = 0; index < edges.length; index++) {
      if (
        typeof edges[index] !== 'string'
        || normalizeUndulateEdge(edges[index]) === null
      ) {
        return `${field}[${index}] must use NODE PATTERN NODE [TEXT] syntax`;
      }
    }
  }
  const nodeError = visitSignals(
    Array.isArray(root.signal) ? root.signal : [],
    (signal) => {
      if (signal.node === undefined) return null;
      if (typeof signal.node !== 'string') return 'node must be a string';
      return parseUndulateNodes(signal.node) === null
        ? 'expanded node names must provide exactly one safe name per # slot'
        : null;
    },
  );
  if (nodeError) return nodeError;
  const waveError = validateWavedromJSON(waveDromValidationView(root), {
    allowUndulateDigitalStates: true,
  });
  if (waveError) return waveError;
  const analogueError = visitSignals(
    Array.isArray(root.signal) ? root.signal : [],
    validateAnalogueSignal,
  );
  if (analogueError) return analogueError;
  const timingError = visitSignals(
    Array.isArray(root.signal) ? root.signal : [],
    validateDigitalTiming,
  );
  if (timingError) return timingError;
  return validateAnnotationStructure(root.annotations);
}

export function validateUndulateFindings(value: unknown): UndulateFinding[] {
  if (!isRecord(value)) {
    return [invalid('root', 'root object', 'must be an object')];
  }
  const findings = scanProperties(value);
  const error = structuralError(value);
  if (error) {
    findings.push(invalid('Undulate document', 'document structure', error));
  }
  return findings;
}

export function validateUndulateJSON(value: unknown): string | null {
  const findings = validateUndulateFindings(value);
  const blocking = findings.filter((item) => item.kind !== 'opaque');
  return blocking.length > 0
    ? blocking.map((item) => item.message).join('\n')
    : null;
}

export function isUndulateJSON(value: unknown): value is UndulateRoot {
  if (!isRecord(value)) return false;
  if (
    Object.prototype.hasOwnProperty.call(value, 'annotations')
    || Object.prototype.hasOwnProperty.call(value, 'edges')
    || (
      Array.isArray(value.edge)
      && value.edge.some(
        (edge) =>
          typeof edge === 'string'
          && hasUndulateOnlyEdgeMarker(edge),
      )
    )
    || scanProperties(value).length > 0
  ) {
    return true;
  }
  if (!Array.isArray(value.signal)) return false;
  let detected = false;
  visitSignals(value.signal, (signal) => {
    const analogue = Object.prototype.hasOwnProperty.call(signal, 'analogue');
    const supported = analogue ? ANALOGUE_SUPPORTED : DIGITAL_SUPPORTED;
    const wave = signal.wave;
    if (
      analogue
      || Object.keys(signal).some((field) => DIGITAL_EXTENSION_FIELDS.has(field))
      || (typeof signal.node === 'string'
        && (signal.node.includes('#') || /\s/.test(signal.node)))
      || Object.keys(signal).some((field) => !supported.has(field))
      || (typeof wave === 'string'
        && EXTENDED_WAVE_FEATURES.some(({ pattern }) => pattern.test(wave)))
    ) {
      detected = true;
    }
    return null;
  });
  return detected;
}
