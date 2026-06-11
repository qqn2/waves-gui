import type { Signal } from '../shared/types';
import { BUS_DIAGONAL, TRACE_PADDING } from '../shared/constants';
import type { ViewTransform } from './coordinates';
import { logicalToCanvasY } from './coordinates';
import { isVectorUnknownValue } from './stateColors';
import { stepLogicalX, stepLogicalXEnd } from './laneTiming';
import { segmentBusFill, segmentBusStroke } from './vectorBusStyle';
import { labelOverflowsInWidth } from '../shared/vectorLabelFit';
import { drawBusOverflowIndicator } from './drawBusOverflowIndicator';
import { drawStepGap } from './drawStepGap';

export function renderVectorSignal(
  ctx: CanvasRenderingContext2D,
  signal: Signal,
  rowYLogical: number,
  rowHeightLogical: number,
  transform: ViewTransform,
): void {
  const scale = transform.zoom * transform.hscale;
  const d = BUS_DIAGONAL * scale;

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
    const fill = segmentBusFill(seg, signal);
    const stroke = segmentBusStroke(seg, signal);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;

    const x1 = stepLogicalX(signal, seg.startStep) * scale - transform.scrollX;
    const x2 = stepLogicalXEnd(signal, seg.endStep - 1) * scale - transform.scrollX;
    const span = x2 - x1;
    const spanTooNarrow = span < d * 3;
    const fontPx = Math.max(10, rowH * 0.35);
    const maxW = span - d * 2 - 8;
    const overflows = labelOverflowsInWidth(seg.value, maxW, fontPx, spanTooNarrow);

    if (spanTooNarrow) {
      ctx.beginPath();
      ctx.moveTo(x1, yHigh);
      ctx.lineTo(x2, yLow);
      ctx.moveTo(x1, yLow);
      ctx.lineTo(x2, yHigh);
      ctx.stroke();
      if (overflows) {
        drawBusOverflowIndicator(ctx, x1, x2, yHigh, yLow, yMid, d, span);
      }
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
    ctx.font = `${fontPx}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (maxW > 4) {
      const lines = seg.value.split('\n');
      const lineHeight = fontPx;
      const blockH = lines.length * lineHeight;
      let lineY = yMid - blockH / 2 + lineHeight / 2;
      for (const line of lines) {
        ctx.fillText(line, (x1 + x2) / 2, lineY, maxW);
        lineY += lineHeight;
      }
    }

    if (overflows) {
      drawBusOverflowIndicator(ctx, x1, x2, yHigh, yLow, yMid, d, span);
    }
  }

  const gapStroke =
    getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() ||
    '#e8e8e8';
  const gapFill =
    getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim() ||
    '#121212';
  const gaps = signal.stepGaps ?? [];
  for (let i = 0; i < gaps.length; i++) {
    if (!gaps[i]) continue;
    const x1 = stepLogicalX(signal, i) * scale - transform.scrollX;
    const x2 = stepLogicalXEnd(signal, i) * scale - transform.scrollX;
    drawStepGap(ctx, x1, x2, yHigh, yLow, gapStroke, gapFill);
  }
}
