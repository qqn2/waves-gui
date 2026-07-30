import type { ViewTransform } from './coordinates';
import { canvasCellWidth, logicalToCanvasY } from './coordinates';

export function renderGrid(
  ctx: CanvasRenderingContext2D,
  totalSteps: number,
  contentHeightLogical: number,
  transform: ViewTransform,
  canvasW: number,
  subdivisions = 1,
): void {
  const cellWidth = canvasCellWidth(transform.hscale, transform.zoom);
  const { scrollX } = transform;

  const startStep = Math.max(0, Math.floor(scrollX / cellWidth));
  const endStep = Math.min(
    totalSteps,
    Math.ceil((scrollX + canvasW) / cellWidth),
  );

  const yTop = logicalToCanvasY(0, transform);
  const yBot = logicalToCanvasY(contentHeightLogical, transform);
  const divisions = Math.max(1, Math.floor(subdivisions));
  const subdivisionWidth = cellWidth / divisions;

  ctx.save();

  // Fine timing is a secondary grid. Hide it when zoom makes divisions too
  // dense to distinguish instead of turning the waveform into visual noise.
  if (divisions > 1 && subdivisionWidth >= 5) {
    ctx.strokeStyle =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--grid-substep-line')
        .trim() || '#9996';
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);

    const startTick = Math.max(0, Math.floor(scrollX / subdivisionWidth));
    const endTick = Math.min(
      totalSteps * divisions,
      Math.ceil((scrollX + canvasW) / subdivisionWidth),
    );
    for (let tick = startTick; tick <= endTick; tick++) {
      if (tick % divisions === 0) continue;
      const xLine = tick * subdivisionWidth - scrollX;
      ctx.beginPath();
      ctx.moveTo(xLine, yTop);
      ctx.lineTo(xLine, yBot);
      ctx.stroke();
    }
  }

  ctx.setLineDash([]);
  ctx.strokeStyle =
    getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim() ||
    '#333';
  ctx.lineWidth = 1;

  for (let i = startStep; i <= endStep; i++) {
    const xLine = i * cellWidth - scrollX;
    ctx.beginPath();
    ctx.moveTo(xLine, yTop);
    ctx.lineTo(xLine, yBot);
    ctx.stroke();
  }
  ctx.restore();
}
