import {
  MAX_ANALOGUE_ABS_VALUE,
  MAX_ANALOGUE_SAMPLES_PER_CELL,
} from '../shared/analogue';
import {
  isSafeAnnotationColor,
  isSafeAnnotationDasharray,
  isSafeAnnotationStrokeWidth,
  MAX_ANNOTATIONS,
  MAX_ANNOTATION_COORDINATE,
  MAX_ANNOTATION_TEXT_LENGTH,
} from '../shared/annotations';
import { validateWavedromJSON } from '../wavedromBridge';
import type { UndulateRoot } from './types';

export const UNDULATE_TARGET_REVISION =
  'c8da7d48c48fc0bbc90113b6913611132bd96c01';

export type UndulateFindingKind =
  | 'wip'
  | 'unsupported-by-design'
  | 'invalid'
  | 'unknown'
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
    supported: ['signal', 'config', 'head', 'foot', 'edge', 'annotations'],
    wip: ['edges'],
    unsupportedByDesign: ['reg', 'register'],
  },
  digitalSignal: {
    supported: ['name', 'wave', 'data', 'node', 'period', 'phase'],
    wip: [
      'repeat',
      'periods',
      'duty_cycle',
      'duty_cycles',
      'slewing',
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
    ],
    wip: [
      'repeat',
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
    ],
    wip: [
      'from',
      'to',
      'dx',
      'dy',
      'font-size',
      'font-weight',
      'color',
      'text_background',
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
const EXTENDED_WAVE_FEATURES = [
  { pattern: /[hHlL]/, feature: 'digital high/low states' },
] as const;

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
      findings.push(unknown(fieldPath));
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
    if (!knownFields.has(field)) findings.push(unknown(`${path}.${field}`));
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
  if (!Array.isArray(signal.analogue)) return;
  signal.analogue.forEach((value, index) => {
    const valuePath = `${path}.analogue[${index}]`;
    if (typeof value === 'string') {
      findings.push(finding(
        'unsupported-by-design',
        'executable analogue expressions',
        valuePath,
        `Unsupported by design: ${valuePath} contains an executable analogue expression; expressions are not executed. Use finite numeric values or explicit [time, value] samples.`,
        'The current diagram was not changed.',
      ));
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
      findings.push(unknown(fieldPath));
      continue;
    }
    if (field === 'wave' && typeof signal.wave === 'string' && !analogue) {
      for (const { pattern, feature } of EXTENDED_WAVE_FEATURES) {
        if (pattern.test(signal.wave)) findings.push(wip(fieldPath, feature));
      }
    } else if (
      field === 'node'
      && typeof signal.node === 'string'
      && (signal.node.includes('#') || /\s/.test(signal.node))
    ) {
      findings.push(wip(fieldPath, 'long node identifiers'));
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
        findings.push(unknown(fieldPath));
      } else if (
        field === 'shape'
        && annotation.shape !== undefined
        && annotation.shape !== '|'
        && annotation.shape !== '||'
        && annotation.shape !== '-'
      ) {
        findings.push(wip(
          fieldPath,
          `annotation shape ${JSON.stringify(annotation.shape)}`,
        ));
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
      } else if (field === 'edge' && Array.isArray(root.edge)) {
        root.edge.forEach((edge, index) => {
          if (typeof edge === 'string' && /[#*]/.test(edge)) {
            findings.push(wip(
              `edge[${index}]`,
              'Undulate extended edge markers # and *',
            ));
          }
        });
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
      findings.push(unknown(field));
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
  const consumingKinds = [...signal.wave].filter((char) => /[sca]/.test(char));
  if (consumingKinds.length !== signal.analogue.length) {
    return 'analogue value count must match s/c/a wave cells';
  }
  for (let index = 0; index < consumingKinds.length; index++) {
    const kind = consumingKinds[index]!;
    const value = signal.analogue[index];
    if (kind === 'a') {
      if (!isFinitePointList(value)) {
        return `analogue[${index}] requires 1 to ${MAX_ANALOGUE_SAMPLES_PER_CELL} finite [time, value] points within the supported voltage range`;
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
      // The property scan emits the precise unsupported-by-design finding.
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
    if (annotation.shape !== undefined) continue;
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
  const waveError = validateWavedromJSON(waveDromValidationView(root));
  if (waveError) return waveError;
  const analogueError = visitSignals(
    Array.isArray(root.signal) ? root.signal : [],
    validateAnalogueSignal,
  );
  if (analogueError) return analogueError;
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
  return findings.length > 0
    ? findings.map((item) => item.message).join('\n')
    : null;
}

export function isUndulateJSON(value: unknown): value is UndulateRoot {
  if (!isRecord(value)) return false;
  if (
    Object.prototype.hasOwnProperty.call(value, 'annotations')
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
