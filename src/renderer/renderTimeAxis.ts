import { TIME_AXIS_HEIGHT } from '../shared/constants';
import { canvasCellWidth } from './coordinates';
import type { ViewTransform } from './coordinates';

export function renderTimeAxis(
  ctx: CanvasRenderingContext2D,
  totalSteps: number,
  transform: ViewTransform,
  width: number,
): void {
  const cellWidth = canvasCellWidth(transform.hscale, transform.zoom);
  const { scrollX } = transform;

  ctx.fillStyle =
    getComputedStyle(document.documentElement).getPropertyValue('--bg-panel').trim() ||
    '#242424';
  ctx.fillRect(0, 0, width, TIME_AXIS_HEIGHT);

  ctx.fillStyle =
    getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() ||
    '#999';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const start = Math.max(0, Math.floor(scrollX / cellWidth));
  const end = Math.min(totalSteps, Math.ceil((scrollX + width) / cellWidth));

  for (let i = start; i < end; i++) {
    const x = i * cellWidth + cellWidth / 2 - scrollX;
    ctx.fillText(String(i), x, TIME_AXIS_HEIGHT / 2);
  }
}
