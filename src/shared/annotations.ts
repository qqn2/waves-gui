import { nanoid } from 'nanoid';
import type {
  AnnotationStyle,
  AnnotationRangePosition,
  DiagramAnnotation,
  DiagramState,
  GlobalCompressionAnnotation,
  HorizontalLineAnnotation,
  SignalOrGroup,
  TextAnnotation,
  VerticalLineAnnotation,
} from './types';

export const MAX_ANNOTATIONS = 1000;
export const MAX_ANNOTATION_TEXT_LENGTH = 2000;
export const MAX_ANNOTATION_Y_OFFSET = 10_000;
export const MAX_ANNOTATION_COORDINATE = 10_000;
export const MAX_ANNOTATION_STROKE_WIDTH = 32;
export const MAX_ANNOTATION_DASH_ITEMS = 16;
export const MAX_ANNOTATION_DASH_VALUE = 1000;

export function normalizeAnnotationRangePosition(
  value: unknown,
): AnnotationRangePosition | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Partial<AnnotationRangePosition>;
  if (
    (candidate.unit !== 'index' && candidate.unit !== 'percent')
    || typeof candidate.value !== 'number'
    || !Number.isFinite(candidate.value)
  ) {
    return undefined;
  }
  if (candidate.unit === 'percent') {
    if (candidate.value < 0 || candidate.value > 100) return undefined;
  } else if (Math.abs(candidate.value) > MAX_ANNOTATION_COORDINATE) {
    return undefined;
  }
  return { unit: candidate.unit, value: candidate.value };
}

/** Parse an inspector value such as `2.5` or `25%`; blank clears the bound. */
export function parseAnnotationRangeInput(
  value: string,
): AnnotationRangePosition | undefined | null {
  const text = value.trim();
  if (text === '') return undefined;
  const percent = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*%$/);
  if (percent) {
    const parsed = Number(percent[1]);
    return parsed >= 0 && parsed <= 100
      ? { unit: 'percent', value: parsed }
      : null;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) && Math.abs(parsed) <= MAX_ANNOTATION_COORDINATE
    ? { unit: 'index', value: parsed }
    : null;
}

export function formatAnnotationRangePosition(
  value: AnnotationRangePosition | undefined,
): string {
  if (!value) return '';
  return value.unit === 'percent' ? `${value.value}%` : String(value.value);
}

export function isSafeAnnotationColor(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const color = value.trim();
  if (/^#[0-9a-f]{3,4}$/i.test(color) || /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color)) {
    return true;
  }
  const match = color.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return false;
  const parts = match[1]!.split(',').map((part) => part.trim());
  const expected = color.toLowerCase().startsWith('rgba(') ? 4 : 3;
  if (parts.length !== expected) return false;
  if (!parts.slice(0, 3).every((part) => {
    const number = Number(part);
    return Number.isInteger(number) && number >= 0 && number <= 255;
  })) return false;
  if (expected === 4) {
    const alpha = Number(parts[3]);
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) return false;
  }
  return true;
}

export function isSafeAnnotationStrokeWidth(value: unknown): value is number {
  return (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= MAX_ANNOTATION_STROKE_WIDTH
  );
}

export function isSafeAnnotationDasharray(value: unknown): value is number[] {
  return (
    Array.isArray(value)
    && value.length > 0
    && value.length <= MAX_ANNOTATION_DASH_ITEMS
    && value.every((item) => (
      typeof item === 'number'
      && Number.isFinite(item)
      && item >= 0
      && item <= MAX_ANNOTATION_DASH_VALUE
    ))
  );
}

export function normalizeAnnotationStyle(
  value: AnnotationStyle | undefined,
): AnnotationStyle | undefined {
  if (!value) return undefined;
  const style: AnnotationStyle = {};
  if (isSafeAnnotationColor(value.fill)) style.fill = value.fill.trim();
  if (isSafeAnnotationColor(value.stroke)) style.stroke = value.stroke.trim();
  if (isSafeAnnotationStrokeWidth(value.strokeWidth)) {
    style.strokeWidth = value.strokeWidth;
  }
  if (isSafeAnnotationDasharray(value.strokeDasharray)) {
    style.strokeDasharray = [...value.strokeDasharray];
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

function finiteInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value)
    : fallback;
}

function finiteCoordinate(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(min, Math.min(max, value));
}

export function normalizeTextAnnotation(
  value: Partial<TextAnnotation>,
  totalSteps: number,
): TextAnnotation {
  const maxTick = Math.max(0, totalSteps - 1);
  const x = finiteCoordinate(
    value.x,
    -MAX_ANNOTATION_COORDINATE,
    MAX_ANNOTATION_COORDINATE,
  );
  const tick = Math.max(
    0,
    Math.min(
      maxTick,
      x === undefined ? finiteInteger(value.tick, 0) : Math.round(x - 0.5),
    ),
  );
  const yOffset = Math.max(
    -MAX_ANNOTATION_Y_OFFSET,
    Math.min(MAX_ANNOTATION_Y_OFFSET, finiteInteger(value.yOffset, 0)),
  );
  const style = normalizeAnnotationStyle(value.style);
  const y = finiteCoordinate(
    value.y,
    -MAX_ANNOTATION_COORDINATE,
    MAX_ANNOTATION_COORDINATE,
  );
  const coordinateMode =
    value.coordinateMode === 'diagram' || value.coordinateMode === 'signal'
      ? value.coordinateMode
      : undefined;

  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : nanoid(),
    type: 'text',
    text:
      typeof value.text === 'string'
        ? value.text.slice(0, MAX_ANNOTATION_TEXT_LENGTH)
        : '',
    tick,
    ...(x !== undefined ? { x } : {}),
    ...(y !== undefined ? { y } : {}),
    ...(coordinateMode ? { coordinateMode } : {}),
    ...(typeof value.snapToGrid === 'boolean'
      ? { snapToGrid: value.snapToGrid }
      : {}),
    ...(typeof value.signalId === 'string' && value.signalId.length > 0
      ? { signalId: value.signalId }
      : {}),
    ...(yOffset !== 0 ? { yOffset } : {}),
    ...(style ? { style } : {}),
  };
}

export function normalizeVerticalLineAnnotation(
  value: Partial<VerticalLineAnnotation>,
  totalSteps: number,
): VerticalLineAnnotation {
  const style = normalizeAnnotationStyle(value.style);
  const x = finiteCoordinate(
    value.x,
    -MAX_ANNOTATION_COORDINATE,
    MAX_ANNOTATION_COORDINATE,
  );
  const rangeFrom = normalizeAnnotationRangePosition(value.rangeFrom);
  const rangeTo = normalizeAnnotationRangePosition(value.rangeTo);
  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : nanoid(),
    type: 'vertical-line',
    tick: Math.max(
      0,
      Math.min(
        Math.max(0, totalSteps - 1),
        x === undefined
          ? finiteInteger(value.tick, 0)
          : Math.round(x - 0.5),
      ),
    ),
    ...(x !== undefined ? { x } : {}),
    ...(typeof value.snapToGrid === 'boolean'
      ? { snapToGrid: value.snapToGrid }
      : {}),
    ...(rangeFrom ? { rangeFrom } : {}),
    ...(rangeTo ? { rangeTo } : {}),
    ...(style ? { style } : {}),
  };
}

export function normalizeHorizontalLineAnnotation(
  value: Partial<HorizontalLineAnnotation>,
): HorizontalLineAnnotation {
  const yOffset = Math.max(
    -MAX_ANNOTATION_Y_OFFSET,
    Math.min(MAX_ANNOTATION_Y_OFFSET, finiteInteger(value.yOffset, 0)),
  );
  const style = normalizeAnnotationStyle(value.style);
  const y = finiteCoordinate(
    value.y,
    -MAX_ANNOTATION_COORDINATE,
    MAX_ANNOTATION_COORDINATE,
  );
  const coordinateMode =
    value.coordinateMode === 'diagram' || value.coordinateMode === 'signal'
      ? value.coordinateMode
      : undefined;
  const rangeFrom = normalizeAnnotationRangePosition(value.rangeFrom);
  const rangeTo = normalizeAnnotationRangePosition(value.rangeTo);
  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : nanoid(),
    type: 'horizontal-line',
    ...(y !== undefined ? { y } : {}),
    ...(coordinateMode ? { coordinateMode } : {}),
    ...(typeof value.signalId === 'string' && value.signalId.length > 0
      ? { signalId: value.signalId }
      : {}),
    ...(yOffset !== 0 ? { yOffset } : {}),
    ...(rangeFrom ? { rangeFrom } : {}),
    ...(rangeTo ? { rangeTo } : {}),
    ...(style ? { style } : {}),
  };
}

export function normalizeGlobalCompressionAnnotation(
  value: Partial<GlobalCompressionAnnotation>,
  totalSteps: number,
): GlobalCompressionAnnotation {
  const style = normalizeAnnotationStyle(value.style);
  const x = finiteCoordinate(
    value.x,
    -MAX_ANNOTATION_COORDINATE,
    MAX_ANNOTATION_COORDINATE,
  );
  const rangeFrom = normalizeAnnotationRangePosition(value.rangeFrom);
  const rangeTo = normalizeAnnotationRangePosition(value.rangeTo);
  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : nanoid(),
    type: 'global-compression',
    tick: Math.max(
      0,
      Math.min(
        Math.max(0, totalSteps - 1),
        x === undefined
          ? finiteInteger(value.tick, 0)
          : Math.round(x - 0.5),
      ),
    ),
    ...(x !== undefined ? { x } : {}),
    ...(typeof value.snapToGrid === 'boolean'
      ? { snapToGrid: value.snapToGrid }
      : {}),
    ...(rangeFrom ? { rangeFrom } : {}),
    ...(rangeTo ? { rangeTo } : {}),
    ...(style ? { style } : {}),
  };
}

export function normalizeAnnotations(
  value: unknown,
  totalSteps: number,
): DiagramAnnotation[] {
  if (!Array.isArray(value)) return [];
  const annotations: DiagramAnnotation[] = [];
  for (const raw of value.slice(0, MAX_ANNOTATIONS)) {
    if (typeof raw !== 'object' || raw === null) continue;
    const record = raw as Partial<DiagramAnnotation>;
    if (record.type === 'text') {
      annotations.push(normalizeTextAnnotation(record as Partial<TextAnnotation>, totalSteps));
    } else if (record.type === 'vertical-line') {
      annotations.push(
        normalizeVerticalLineAnnotation(
          record as Partial<VerticalLineAnnotation>,
          totalSteps,
        ),
      );
    } else if (record.type === 'horizontal-line') {
      annotations.push(
        normalizeHorizontalLineAnnotation(
          record as Partial<HorizontalLineAnnotation>,
        ),
      );
    } else if (record.type === 'global-compression') {
      annotations.push(
        normalizeGlobalCompressionAnnotation(
          record as Partial<GlobalCompressionAnnotation>,
          totalSteps,
        ),
      );
    }
  }
  return annotations;
}

export interface ExtensionContentSummary {
  annotationCount: number;
  analogueSignalCount: number;
  totalCount: number;
  hasExtensions: boolean;
}

export function scanExtensionContent(
  diagram:
    Pick<DiagramState, 'annotations'>
    & Partial<Pick<DiagramState, 'signals'>>,
): ExtensionContentSummary {
  const annotationCount = diagram.annotations?.length ?? 0;
  let analogueSignalCount = 0;
  const countAnalogue = (signals: SignalOrGroup[]) => {
    for (const signal of signals) {
      if (signal.type === 'group') countAnalogue(signal.children);
      else if (signal.type === 'analogue') analogueSignalCount++;
    }
  };
  countAnalogue(diagram.signals ?? []);
  const totalCount = annotationCount + analogueSignalCount;
  return {
    annotationCount,
    analogueSignalCount,
    totalCount,
    hasExtensions: totalCount > 0,
  };
}
