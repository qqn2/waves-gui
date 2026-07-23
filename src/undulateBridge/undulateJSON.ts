import { nanoid } from 'nanoid';
import { buildRowLayout } from '../renderer/rowLayout';
import { ROW_HEIGHT } from '../shared/constants';
import { normalizeDiagram } from '../shared/normalizeDiagram';
import type { DiagramAnnotation, DiagramState } from '../shared/types';
import {
  fromWavedromJSON,
  toWavedromJSON,
  validateWavedromJSON,
} from '../wavedromBridge';
import type { UndulateRoot, UndulateTextAnnotation } from './types';

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

export function toUndulateJSON(diagram: DiagramState): UndulateRoot {
  const root: UndulateRoot = toWavedromJSON(diagram);
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

export function validateUndulateJSON(value: unknown): string | null {
  const waveError = validateWavedromJSON(value);
  if (waveError) return waveError;
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

export function fromUndulateJSON(root: UndulateRoot): DiagramState {
  const diagram = fromWavedromJSON(root);
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
      extensionsEnabled: annotations.length > 0,
      sourceFormat: 'undulate-json',
      sourceRevision: UNDULATE_TARGET_REVISION,
    },
    annotations,
  });
}
