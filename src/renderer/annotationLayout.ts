import { CELL_WIDTH, ROW_HEIGHT } from '../shared/constants';
import type {
  DiagramState,
  AnnotationRangePosition,
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
  | {
      annotation: VerticalLineAnnotation;
      orientation: 'vertical';
      position: number;
      rangeStart: number;
      rangeEnd: number;
    }
  | {
      annotation: GlobalCompressionAnnotation;
      orientation: 'compression';
      position: number;
      rangeStart: number;
      rangeEnd: number;
    }
  | {
      annotation: HorizontalLineAnnotation;
      orientation: 'horizontal';
      position: number;
      rangeStart: number;
      rangeEnd: number;
    };

function resolveRangePosition(
  value: AnnotationRangePosition | undefined,
  fullLength: number,
  indexScale: number,
  fallback: number,
): number {
  if (!value) return fallback;
  return value.unit === 'percent'
    ? fullLength * value.value / 100
    : value.value * indexScale;
}

function annotationRange(
  annotation:
    | VerticalLineAnnotation
    | HorizontalLineAnnotation
    | GlobalCompressionAnnotation,
  fullLength: number,
  indexScale: number,
): { rangeStart: number; rangeEnd: number } {
  const from = resolveRangePosition(
    annotation.rangeFrom,
    fullLength,
    indexScale,
    0,
  );
  const to = resolveRangePosition(
    annotation.rangeTo,
    fullLength,
    indexScale,
    fullLength,
  );
  return {
    rangeStart: Math.min(from, to),
    rangeEnd: Math.max(from, to),
  };
}

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
  diagram: Pick<DiagramState, 'annotations' | 'compatibility' | 'config'>,
  rows: RowLayoutEntry[],
): LineAnnotationLayout[] {
  if (diagram.compatibility?.extensionsEnabled !== true) return [];
  const layouts: LineAnnotationLayout[] = [];
  const contentHeight = rows.length > 0
    ? rows[rows.length - 1]!.y + rows[rows.length - 1]!.height
    : 0;
  const contentWidth = diagram.config.totalSteps * CELL_WIDTH;
  for (const annotation of diagram.annotations ?? []) {
    if (annotation.type === 'vertical-line' || annotation.type === 'global-compression') {
      if (annotation.type === 'vertical-line') {
        layouts.push({
          annotation,
          orientation: 'vertical',
          position: annotationXCells(annotation) * CELL_WIDTH,
          ...annotationRange(annotation, contentHeight, ROW_HEIGHT),
        });
      } else {
        layouts.push({
          annotation,
          orientation: 'compression',
          position: annotationXCells(annotation) * CELL_WIDTH,
          ...annotationRange(annotation, contentHeight, ROW_HEIGHT),
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
      ...annotationRange(annotation, contentWidth, CELL_WIDTH),
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
  diagram: Pick<DiagramState, 'annotations' | 'compatibility' | 'config'>,
  rows: RowLayoutEntry[],
  transform: ViewTransform,
  waveformTop: number,
): string | null {
  const lineLayouts = layoutLineAnnotations(diagram, rows);
  for (let index = lineLayouts.length - 1; index >= 0; index -= 1) {
    const layout = lineLayouts[index]!;
    if (layout.orientation === 'vertical' || layout.orientation === 'compression') {
      const x = logicalToCanvasX(layout.position, transform);
      const yStart = waveformTop + logicalToCanvasY(layout.rangeStart, transform);
      const yEnd = waveformTop + logicalToCanvasY(layout.rangeEnd, transform);
      if (
        Math.abs(canvasX - x) <= 5
        && canvasY >= yStart - 5
        && canvasY <= yEnd + 5
      ) return layout.annotation.id;
    } else {
      const y = waveformTop + logicalToCanvasY(layout.position, transform);
      const xStart = logicalToCanvasX(layout.rangeStart, transform);
      const xEnd = logicalToCanvasX(layout.rangeEnd, transform);
      if (
        Math.abs(canvasY - y) <= 5
        && canvasX >= xStart - 5
        && canvasX <= xEnd + 5
      ) return layout.annotation.id;
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
