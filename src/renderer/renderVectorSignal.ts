import type { Signal } from '../shared/types';
import { BUS_DIAGONAL, TRACE_PADDING } from '../shared/constants';
import type { ViewTransform } from './coordinates';
import { canvasCellWidth, logicalToCanvasY } from './coordinates';

export function renderVectorSignal(
  ctx: CanvasRenderingContext2D,
  signal: Signal,
  rowYLogical: number,
  rowHeightLogical: number,
  transform: ViewTransform,
): void {
  const cellWidth = canvasCellWidth(transform.hscale, transform.zoom);
  const d = BUS_DIAGONAL * transform.zoom * transform.hscale;

  const rowY = logicalToCanvasY(rowYLogical, transform);
  const rowH = rowHeightLogical * transform.zoom;
  const yMid = rowY + rowH / 2;
  const yHigh = rowY + TRACE_PADDING * transform.zoom;
  const yLow = rowY + rowH - TRACE_PADDING * transform.zoom;

  ctx.strokeStyle = signal.color;
  ctx.fillStyle = signal.fillColor ?? `${signal.color}30`;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);

  for (const seg of signal.segments) {
    const fill = seg.color ?? signal.fillColor ?? `${signal.color}30`;
    ctx.fillStyle = fill;

    const x1 = seg.startStep * cellWidth - transform.scrollX;
    const x2 = seg.endStep * cellWidth - transform.scrollX;
    const span = x2 - x1;

    if (span < d * 3) {
      ctx.beginPath();
      ctx.moveTo(x1, yHigh);
      ctx.lineTo(x2, yLow);
      ctx.moveTo(x1, yLow);
      ctx.lineTo(x2, yHigh);
      ctx.stroke();
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(x1, yMid);
    ctx.lineTo(x1 + d, yHigh);
    ctx.lineTo(x2 - d, yHigh);
    ctx.lineTo(x2, yMid);
    ctx.lineTo(x2 - d, yLow);
    ctx.lineTo(x1 + d, yLow);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle =
      getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() ||
      '#e8e8e8';
    ctx.font = `${Math.max(10, rowH * 0.35)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxW = span - d * 2 - 8;
    if (maxW > 4) {
      ctx.fillText(seg.value, (x1 + x2) / 2, yMid, maxW);
    }
  }
}
