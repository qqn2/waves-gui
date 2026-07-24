import { CELL_WIDTH } from '../shared/constants';
import type {
  DiagramState,
  HorizontalLineAnnotation,
  GlobalCompressionAnnotation,
  TextAnnotation,
  VerticalLineAnnotation,
} from '../shared/types';
import type { RowLayoutEntry } from './rowLayout';
import {
  logicalToCanvasX,
  logicalToCanvasY,
  type ViewTransform,
} from './coordinates';

export interface TextAnnotationLayout {
  annotation: TextAnnotation;
  x: number;
  y: number;
}

export type LineAnnotationLayout =
  | { annotation: VerticalLineAnnotation; orientation: 'vertical'; position: number }
  | { annotation: GlobalCompressionAnnotation; orientation: 'compression'; position: number }
  | { annotation: HorizontalLineAnnotation; orientation: 'horizontal'; position: number };

export function layoutLineAnnotations(
  diagram: Pick<DiagramState, 'annotations' | 'compatibility'>,
  rows: RowLayoutEntry[],
): LineAnnotationLayout[] {
  if (diagram.compatibility?.extensionsEnabled !== true) return [];
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const layouts: LineAnnotationLayout[] = [];
  for (const annotation of diagram.annotations ?? []) {
    if (annotation.type === 'vertical-line' || annotation.type === 'global-compression') {
      if (annotation.type === 'vertical-line') {
        layouts.push({
          annotation,
          orientation: 'vertical',
          position: (annotation.tick + 0.5) * CELL_WIDTH,
        });
      } else {
        layouts.push({
          annotation,
          orientation: 'compression',
          position: (annotation.tick + 0.5) * CELL_WIDTH,
        });
      }
      continue;
    }
    if (annotation.type !== 'horizontal-line') continue;
    if (!annotation.signalId) {
      layouts.push({
        annotation,
        orientation: 'horizontal',
        position: annotation.yOffset ?? 16,
      });
      continue;
    }
    const row = rowById.get(annotation.signalId);
    if (!row) continue;
    layouts.push({
      annotation,
      orientation: 'horizontal',
      position: row.y + row.height / 2 + (annotation.yOffset ?? 0),
    });
  }
  return layouts;
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

export function hitTestAnnotation(
  canvasX: number,
  canvasY: number,
  diagram: Pick<DiagramState, 'annotations' | 'compatibility'>,
  rows: RowLayoutEntry[],
  transform: ViewTransform,
  waveformTop: number,
): string | null {
  const lineLayouts = layoutLineAnnotations(diagram, rows);
  for (let index = lineLayouts.length - 1; index >= 0; index -= 1) {
    const layout = lineLayouts[index]!;
    if (layout.orientation === 'vertical' || layout.orientation === 'compression') {
      const x = logicalToCanvasX(layout.position, transform);
      if (Math.abs(canvasX - x) <= 5) return layout.annotation.id;
    } else {
      const y = waveformTop + logicalToCanvasY(layout.position, transform);
      if (Math.abs(canvasY - y) <= 5) return layout.annotation.id;
    }
  }
  const layouts = layoutTextAnnotations(diagram, rows);
  for (let index = layouts.length - 1; index >= 0; index -= 1) {
    const { annotation, x, y } = layouts[index]!;
    const centerX = logicalToCanvasX(x, transform);
    const centerY = waveformTop + logicalToCanvasY(y, transform);
    const width = Math.max(24, annotation.text.length * 7) * transform.zoom + 8;
    const height = Math.max(14, 18 * transform.zoom);
    if (
      Math.abs(canvasX - centerX) <= width / 2
      && Math.abs(canvasY - centerY) <= height / 2
    ) {
      return annotation.id;
    }
  }
  return null;
}
