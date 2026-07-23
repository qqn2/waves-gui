import { nanoid } from 'nanoid';
import type {
  DiagramAnnotation,
  DiagramState,
  TextAnnotation,
} from './types';

export const MAX_ANNOTATIONS = 1000;
export const MAX_ANNOTATION_TEXT_LENGTH = 2000;
export const MAX_ANNOTATION_Y_OFFSET = 10_000;

function finiteInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value)
    : fallback;
}

export function normalizeTextAnnotation(
  value: Partial<TextAnnotation>,
  totalSteps: number,
): TextAnnotation {
  const maxTick = Math.max(0, totalSteps - 1);
  const tick = Math.max(0, Math.min(maxTick, finiteInteger(value.tick, 0)));
  const yOffset = Math.max(
    -MAX_ANNOTATION_Y_OFFSET,
    Math.min(MAX_ANNOTATION_Y_OFFSET, finiteInteger(value.yOffset, 0)),
  );

  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : nanoid(),
    type: 'text',
    text:
      typeof value.text === 'string'
        ? value.text.slice(0, MAX_ANNOTATION_TEXT_LENGTH)
        : '',
    tick,
    ...(typeof value.signalId === 'string' && value.signalId.length > 0
      ? { signalId: value.signalId }
      : {}),
    ...(yOffset !== 0 ? { yOffset } : {}),
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
    const record = raw as Partial<TextAnnotation>;
    if (record.type !== 'text') continue;
    annotations.push(normalizeTextAnnotation(record, totalSteps));
  }
  return annotations;
}

export interface ExtensionContentSummary {
  annotationCount: number;
  totalCount: number;
  hasExtensions: boolean;
}

export function scanExtensionContent(
  diagram: Pick<DiagramState, 'annotations'>,
): ExtensionContentSummary {
  const annotationCount = diagram.annotations?.length ?? 0;
  return {
    annotationCount,
    totalCount: annotationCount,
    hasExtensions: annotationCount > 0,
  };
}
