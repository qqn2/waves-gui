import { CELL_WIDTH, TRACE_PADDING } from '../shared/constants';
import type { Signal } from '../shared/types';
import type { ViewTransform } from './coordinates';
import { logicalToCanvasY } from './coordinates';
import {
  analoguePathPoints,
  analogueValueRatio,
} from './analogueGeometry';
import {
  signalStroke,
  signalStrokeDasharray,
  signalStrokeWidth,
} from './signalStyle';

export function renderAnalogueSignal(
  ctx: CanvasRenderingContext2D,
  signal: Signal,
  rowYLogical: number,
  rowHeightLogical: number,
  transform: ViewTransform,
): void {
  const points = analoguePathPoints(signal);
  if (points.length === 0) return;
  const scaleX = transform.zoom * transform.hscale;
  const rowY = logicalToCanvasY(rowYLogical, transform);
  const rowHeight = rowHeightLogical * transform.zoom;
  const padding = TRACE_PADDING * transform.zoom;
  const usableHeight = Math.max(1, rowHeight - padding * 2);
  const x = (step: number) =>
    step * CELL_WIDTH * scaleX - transform.scrollX;
  const y = (value: number) =>
    rowY + padding + (1 - analogueValueRatio(signal, value)) * usableHeight;

  ctx.save();
  ctx.strokeStyle = signalStroke(signal);
  ctx.lineWidth = signalStrokeWidth(signal);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(signalStrokeDasharray(signal));
  ctx.beginPath();
  ctx.moveTo(x(points[0]!.step), y(points[0]!.value));
  for (const point of points.slice(1)) {
    ctx.lineTo(x(point.step), y(point.value));
  }
  ctx.stroke();
  ctx.restore();
}
