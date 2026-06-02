import type { Signal } from '../shared/types';
import { BUS_DIAGONAL, TRACE_PADDING } from '../shared/constants';
import type { ViewTransform } from './coordinates';
import { canvasCellWidth, logicalToCanvasY } from './coordinates';
import {
  isVectorUnknownValue,
  vectorUnknownFill,
  vectorUnknownStroke,
} from './stateColors';

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

  ctx.lineWidth = 2;
  ctx.setLineDash([]);

  const textPrimary =
    getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() ||
    '#e8e8e8';
  const textSecondary =
    getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() ||
    '#b0b0b0';

  for (const seg of signal.segments) {
    const unknown = isVectorUnknownValue(seg.value);
    const fill = unknown
      ? vectorUnknownFill()
      : (signal.fillColor ?? `${signal.color}30`);
    const stroke = unknown ? vectorUnknownStroke() : signal.color;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;

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

    ctx.fillStyle = unknown ? textSecondary : textPrimary;
    ctx.font = `${Math.max(10, rowH * 0.35)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxW = span - d * 2 - 8;
    if (maxW > 4) {
      ctx.fillText(seg.value, (x1 + x2) / 2, yMid, maxW);
    }
  }
}
