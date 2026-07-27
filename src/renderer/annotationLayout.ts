import { CELL_WIDTH, ROW_HEIGHT } from '../shared/constants';
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

export function annotationXCells(
  annotation: TextAnnotation | VerticalLineAnnotation | GlobalCompressionAnnotation,
): number {
  return annotation.x ?? annotation.tick + 0.5;
}

export function annotationYLogical(
  annotation: TextAnnotation | HorizontalLineAnnotation,
  rows: RowLayoutEntry[],
): number | null {
  if (annotation.coordinateMode === 'diagram' && annotation.y !== undefined) {
    return annotation.y * ROW_HEIGHT;
  }
  if (!annotation.signalId) {
    return annotation.y !== undefined
      ? annotation.y * ROW_HEIGHT
      : annotation.yOffset ?? 16;
  }
  const row = rows.find((candidate) => candidate.id === annotation.signalId);
  if (!row) return null;
  return row.y + row.height / 2 + (annotation.yOffset ?? 0);
}

export function layoutLineAnnotations(
  diagram: Pick<DiagramState, 'annotations' | 'compatibility'>,
  rows: RowLayoutEntry[],
): LineAnnotationLayout[] {
  if (diagram.compatibility?.extensionsEnabled !== true) return [];
  const layouts: LineAnnotationLayout[] = [];
  for (const annotation of diagram.annotations ?? []) {
    if (annotation.type === 'vertical-line' || annotation.type === 'global-compression') {
      if (annotation.type === 'vertical-line') {
        layouts.push({
          annotation,
          orientation: 'vertical',
          position: annotationXCells(annotation) * CELL_WIDTH,
        });
      } else {
        layouts.push({
          annotation,
          orientation: 'compression',
          position: annotationXCells(annotation) * CELL_WIDTH,
        });
      }
      continue;
    }
    if (annotation.type !== 'horizontal-line') continue;
    const position = annotationYLogical(annotation, rows);
    if (position === null) continue;
    layouts.push({
      annotation,
      orientation: 'horizontal',
      position,
    });
  }
  return layouts;
}

export function layoutTextAnnotations(
  diagram: Pick<DiagramState, 'annotations' | 'compatibility'>,
  rows: RowLayoutEntry[],
): TextAnnotationLayout[] {
  if (diagram.compatibility?.extensionsEnabled !== true) return [];

  return (diagram.annotations ?? []).flatMap((annotation) => {
    if (annotation.type !== 'text') return [];
    const x = annotationXCells(annotation) * CELL_WIDTH;
    const y = annotationYLogical(annotation, rows);
    if (y === null) return [];
    return [{
      annotation,
      x,
      y,
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
