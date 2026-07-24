import { nanoid } from 'nanoid';
import type {
  DiagramAnnotation,
  DiagramState,
  HorizontalLineAnnotation,
  SignalOrGroup,
  TextAnnotation,
  VerticalLineAnnotation,
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

export function normalizeVerticalLineAnnotation(
  value: Partial<VerticalLineAnnotation>,
  totalSteps: number,
): VerticalLineAnnotation {
  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : nanoid(),
    type: 'vertical-line',
    tick: Math.max(
      0,
      Math.min(Math.max(0, totalSteps - 1), finiteInteger(value.tick, 0)),
    ),
  };
}

export function normalizeHorizontalLineAnnotation(
  value: Partial<HorizontalLineAnnotation>,
): HorizontalLineAnnotation {
  const yOffset = Math.max(
    -MAX_ANNOTATION_Y_OFFSET,
    Math.min(MAX_ANNOTATION_Y_OFFSET, finiteInteger(value.yOffset, 0)),
  );
  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : nanoid(),
    type: 'horizontal-line',
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

function leafSignalIds(signals: SignalOrGroup[]): string[] {
  const ids: string[] = [];
  const visit = (items: SignalOrGroup[]) => {
    for (const item of items) {
      if (item.type === 'group') visit(item.children);
      else ids.push(item.id);
    }
  };
  visit(signals);
  return ids;
}

/**
 * The raw code panel edits WaveDrom JSON, which cannot carry extension fields.
 * Preserve annotations and remap semantic anchors by leaf-lane position.
 */
export function preserveExtensionsAcrossDiagramEdit(
  previous: DiagramState,
  incoming: DiagramState,
): DiagramState {
  if (
    (previous.annotations?.length ?? 0) === 0
    || (incoming.annotations?.length ?? 0) > 0
  ) {
    return incoming;
  }

  const previousIds = leafSignalIds(previous.signals);
  const incomingIds = leafSignalIds(incoming.signals);
  const annotations = previous.annotations!.map((annotation) => {
    if (annotation.type === 'vertical-line') return { ...annotation };
    if (!annotation.signalId) return { ...annotation };
    const laneIndex = previousIds.indexOf(annotation.signalId);
    const signalId = laneIndex >= 0 ? incomingIds[laneIndex] : undefined;
    if (signalId) return { ...annotation, signalId };
    const detached = { ...annotation };
    delete detached.signalId;
    return detached;
  });

  return {
    ...incoming,
    version: 2,
    compatibility: previous.compatibility,
    annotations,
  };
}
