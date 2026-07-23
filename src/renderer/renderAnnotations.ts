import type { DiagramState } from '../shared/types';
import {
  logicalToCanvasX,
  logicalToCanvasY,
  type ViewTransform,
} from './coordinates';
import { layoutTextAnnotations } from './annotationLayout';
import type { RowLayoutEntry } from './rowLayout';

function themeColor(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    || fallback;
}

export function renderTextAnnotations(
  ctx: CanvasRenderingContext2D,
  diagram: DiagramState,
  rows: RowLayoutEntry[],
  transform: ViewTransform,
): void {
  const layouts = layoutTextAnnotations(diagram, rows);
  if (layouts.length === 0) return;

  ctx.save();
  ctx.font = `${Math.max(9, 12 * transform.zoom)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const { annotation, x, y } of layouts) {
    const canvasX = logicalToCanvasX(x, transform);
    const canvasY = logicalToCanvasY(y, transform);
    const width = ctx.measureText(annotation.text).width;
    const paddingX = 4;
    const height = Math.max(14, 16 * transform.zoom);
    ctx.fillStyle = themeColor('--bg-panel', '#242424');
    ctx.fillRect(
      canvasX - width / 2 - paddingX,
      canvasY - height / 2,
      width + paddingX * 2,
      height,
    );
    ctx.fillStyle = themeColor('--text-primary', '#e8e8e8');
    ctx.fillText(annotation.text, canvasX, canvasY);
  }

  ctx.restore();
}
