import type { ViewTransform } from './coordinates';
import { canvasCellWidth, logicalToCanvasY } from './coordinates';

export function renderGrid(
  ctx: CanvasRenderingContext2D,
  totalSteps: number,
  contentHeightLogical: number,
  transform: ViewTransform,
  canvasW: number,
): void {
  const cellWidth = canvasCellWidth(transform.hscale, transform.zoom);
  const { scrollX } = transform;

  ctx.strokeStyle =
    getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim() ||
    '#333';
  ctx.lineWidth = 1;

  const startStep = Math.max(0, Math.floor(scrollX / cellWidth));
  const endStep = Math.min(
    totalSteps,
    Math.ceil((scrollX + canvasW) / cellWidth),
  );

  const yTop = logicalToCanvasY(0, transform);
  const yBot = logicalToCanvasY(contentHeightLogical, transform);

  for (let i = startStep; i <= endStep; i++) {
    const xLine = i * cellWidth - scrollX;
    ctx.beginPath();
    ctx.moveTo(xLine, yTop);
    ctx.lineTo(xLine, yBot);
    ctx.stroke();
  }
}
