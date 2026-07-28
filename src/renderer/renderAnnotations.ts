import type { DiagramState } from '../shared/types';
import {
  logicalToCanvasX,
  logicalToCanvasY,
  type ViewTransform,
} from './coordinates';
import {
  layoutArrowAnnotations,
  layoutLineAnnotations,
  layoutTextAnnotations,
} from './annotationLayout';
import type { RowLayoutEntry } from './rowLayout';
import { splitEdgeConnector } from '../shared/edgeSyntax';

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
  const arrowLayouts = layoutArrowAnnotations(diagram, rows);
  if (layouts.length === 0 && lineLayouts.length === 0 && arrowLayouts.length === 0) return;

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

  for (const { annotation, from, to } of arrowLayouts) {
    const x1 = logicalToCanvasX(from.x, transform);
    const y1 = logicalToCanvasY(from.y, transform);
    const x2 = logicalToCanvasX(to.x, transform);
    const y2 = logicalToCanvasY(to.y, transform);
    ctx.strokeStyle = annotation.style?.stroke ?? themeColor('--accent', '#4a9eff');
    ctx.lineWidth = annotation.style?.strokeWidth ?? 1.5;
    ctx.setLineDash(annotation.style?.strokeDasharray ?? []);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    if (annotation.shape.includes('~')) {
      ctx.bezierCurveTo(x1 + (x2 - x1) / 2, y1, x1 + (x2 - x1) / 2, y2, x2, y2);
    } else {
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    const head = (x: number, y: number, angle: number) => {
      const size = 7 * transform.zoom;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - size * Math.cos(angle - 0.45), y - size * Math.sin(angle - 0.45));
      ctx.moveTo(x, y);
      ctx.lineTo(x - size * Math.cos(angle + 0.45), y - size * Math.sin(angle + 0.45));
      ctx.stroke();
    };
    if (annotation.shape.includes('>')) head(x2, y2, Math.atan2(y2 - y1, x2 - x1));
    if (annotation.shape.includes('<')) head(x1, y1, Math.atan2(y1 - y2, x1 - x2));
    const endpoints = splitEdgeConnector(annotation.shape);
    const endpointMarker = (
      decoration: 'none' | 'arrow' | 'square' | 'circle',
      x: number,
      y: number,
    ) => {
      if (decoration !== 'square' && decoration !== 'circle') return;
      const size = 8 * transform.zoom;
      ctx.fillStyle = annotation.style?.stroke ?? themeColor('--accent', '#4a9eff');
      ctx.beginPath();
      if (decoration === 'square') {
        ctx.rect(x - size / 2, y - size / 2, size, size);
      } else {
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      }
      ctx.fill();
    };
    endpointMarker(endpoints.start, x1, y1);
    endpointMarker(endpoints.end, x2, y2);
    if (annotation.text) {
      const fontSize = annotation.style?.fontSize ?? 12;
      const labelX = (x1 + x2) / 2 + (annotation.dx ?? 0);
      const labelY = (y1 + y2) / 2 + (annotation.dy ?? 0);
      ctx.font = `${Math.max(6, fontSize * transform.zoom)}px sans-serif`;
      if (annotation.style?.textBackground !== false) {
        const width = ctx.measureText(annotation.text).width;
        const height = Math.max(14, fontSize * 1.35 * transform.zoom);
        ctx.fillStyle = themeColor('--bg-canvas', '#111111');
        ctx.fillRect(labelX - width / 2 - 4, labelY - height / 2, width + 8, height);
      }
      ctx.fillStyle = annotation.style?.fill ?? themeColor('--text-primary', '#e8e8e8');
      ctx.fillText(annotation.text, labelX, labelY);
    }
    if (annotation.id === selectedAnnotationId) {
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = themeColor('--accent', '#4a9eff');
      ctx.fillStyle = themeColor('--bg-canvas', '#111111');
      for (const [x, y] of [[x1, y1], [x2, y2]]) {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(4, 5 * transform.zoom), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  for (const { annotation, x, y } of layouts) {
    const canvasX = logicalToCanvasX(x, transform);
    const canvasY = logicalToCanvasY(y, transform);
    const fontSize = annotation.style?.fontSize ?? 12;
    ctx.font = `${Math.max(6, fontSize * transform.zoom)}px sans-serif`;
    const width = ctx.measureText(annotation.text).width;
    const paddingX = 4;
    const height = Math.max(14, fontSize * 1.35 * transform.zoom);
    if (annotation.style?.textBackground !== false) {
      ctx.fillStyle = themeColor('--bg-canvas', '#111111');
      ctx.fillRect(
        canvasX - width / 2 - paddingX,
        canvasY - height / 2,
        width + paddingX * 2,
        height,
      );
    }
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
