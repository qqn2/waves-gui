/** WaveDrom `|` gap: vertical break across the trace band. */
export function drawStepGap(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  yHigh: number,
  yLow: number,
  stroke: string,
): void {
  const xMid = (x1 + x2) / 2;
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(xMid, yHigh);
  ctx.lineTo(xMid, yLow);
  ctx.stroke();
  ctx.restore();
}

export function svgStepGap(
  x1: number,
  x2: number,
  yHigh: number,
  yLow: number,
  stroke: string,
): string {
  const xMid = (x1 + x2) / 2;
  return `<line x1="${xMid}" y1="${yHigh}" x2="${xMid}" y2="${yLow}" stroke="${stroke}" stroke-width="2"/>`;
}
