import { CELL_WIDTH } from '../shared/constants';
import type {
  DiagramState,
  TextAnnotation,
} from '../shared/types';
import type { RowLayoutEntry } from './rowLayout';

export interface TextAnnotationLayout {
  annotation: TextAnnotation;
  x: number;
  y: number;
}

export function layoutTextAnnotations(
  diagram: Pick<DiagramState, 'annotations' | 'compatibility'>,
  rows: RowLayoutEntry[],
): TextAnnotationLayout[] {
  if (diagram.compatibility?.extensionsEnabled !== true) return [];
  const rowById = new Map(rows.map((row) => [row.id, row]));

  return (diagram.annotations ?? []).flatMap((annotation) => {
    if (annotation.type !== 'text') return [];
    const x = (annotation.tick + 0.5) * CELL_WIDTH;
    if (!annotation.signalId) {
      return [{
        annotation,
        x,
        y: annotation.yOffset ?? 16,
      }];
    }
    const row = rowById.get(annotation.signalId);
    if (!row) return [];
    return [{
      annotation,
      x,
      y: row.y + row.height / 2 + (annotation.yOffset ?? 0),
    }];
  });
}
