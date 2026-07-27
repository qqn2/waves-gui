import type { DiagramState } from '../shared/types';
import {
  logicalToCanvasX,
  logicalToCanvasY,
  type ViewTransform,
} from './coordinates';
import { layoutLineAnnotations, layoutTextAnnotations } from './annotationLayout';
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
  selectedAnnotationId?: string | null,
): void {
  const layouts = layoutTextAnnotations(diagram, rows);
  const lineLayouts = layoutLineAnnotations(diagram, rows);
  if (layouts.length === 0 && lineLayouts.length === 0) return;

  ctx.save();
  ctx.strokeStyle = themeColor('--accent', '#4a9eff');
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  for (const layout of lineLayouts) {
    const style = layout.annotation.style;
    ctx.strokeStyle = style?.stroke ?? themeColor('--accent', '#4a9eff');
    ctx.lineWidth = style?.strokeWidth ?? 1.5;
    ctx.setLineDash(
      style?.strokeDasharray
      ?? (layout.orientation === 'compression' ? [] : [5, 4]),
    );
    ctx.beginPath();
    if (layout.orientation === 'vertical' || layout.orientation === 'compression') {
      const x = logicalToCanvasX(layout.position, transform);
      const offset = layout.orientation === 'compression' ? 3 * transform.zoom : 0;
      if (layout.orientation === 'compression') {
        ctx.save();
        ctx.fillStyle = themeColor('--bg-canvas', '#111111');
        ctx.fillRect(
          x - 6 * transform.zoom,
          logicalToCanvasY(layout.rangeStart, transform),
          12 * transform.zoom,
          (layout.rangeEnd - layout.rangeStart) * transform.zoom,
        );
        ctx.restore();
        ctx.beginPath();
      }
      ctx.moveTo(x - offset, logicalToCanvasY(layout.rangeStart, transform));
      ctx.lineTo(x - offset, logicalToCanvasY(layout.rangeEnd, transform));
      if (layout.orientation === 'compression') {
        ctx.moveTo(x + offset, logicalToCanvasY(layout.rangeStart, transform));
        ctx.lineTo(x + offset, logicalToCanvasY(layout.rangeEnd, transform));
      }
    } else {
      const y = logicalToCanvasY(layout.position, transform);
      ctx.moveTo(logicalToCanvasX(layout.rangeStart, transform), y);
      ctx.lineTo(logicalToCanvasX(layout.rangeEnd, transform), y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.font = `${Math.max(9, 12 * transform.zoom)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const { annotation, x, y } of layouts) {
    const canvasX = logicalToCanvasX(x, transform);
    const canvasY = logicalToCanvasY(y, transform);
    const width = ctx.measureText(annotation.text).width;
    const paddingX = 4;
    const height = Math.max(14, 16 * transform.zoom);
    ctx.fillStyle = themeColor('--bg-canvas', '#111111');
    ctx.fillRect(
      canvasX - width / 2 - paddingX,
      canvasY - height / 2,
      width + paddingX * 2,
      height,
    );
    if (annotation.id === selectedAnnotationId) {
      ctx.strokeStyle = themeColor('--accent', '#4a9eff');
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        canvasX - width / 2 - paddingX,
        canvasY - height / 2,
        width + paddingX * 2,
        height,
      );
    }
    ctx.fillStyle = annotation.style?.fill
      ?? themeColor('--text-primary', '#e8e8e8');
    if (annotation.style?.stroke) {
      ctx.strokeStyle = annotation.style.stroke;
      ctx.lineWidth = annotation.style.strokeWidth ?? 1;
      ctx.setLineDash(annotation.style.strokeDasharray ?? []);
      ctx.strokeText(annotation.text, canvasX, canvasY);
      ctx.setLineDash([]);
    }
    ctx.fillText(annotation.text, canvasX, canvasY);
  }

  ctx.restore();
}
