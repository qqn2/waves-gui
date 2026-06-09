const OVERFLOW_COLOR = '#e8a040';

/** Dashed warning outline + clip marker on bus segments whose label does not fit. */
export function drawBusOverflowIndicator(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  yHigh: number,
  yLow: number,
  yMid: number,
  d: number,
  span: number,
): void {
  ctx.save();
  ctx.strokeStyle = OVERFLOW_COLOR;
  ctx.fillStyle = OVERFLOW_COLOR;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);

  if (span < d * 3) {
    ctx.beginPath();
    ctx.moveTo(x1, yHigh);
    ctx.lineTo(x2, yLow);
    ctx.moveTo(x1, yLow);
    ctx.lineTo(x2, yHigh);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x1, yMid);
    ctx.lineTo(x1 + d, yHigh);
    ctx.lineTo(x2 - d, yHigh);
    ctx.lineTo(x2, yMid);
    ctx.lineTo(x2 - d, yLow);
    ctx.lineTo(x1 + d, yLow);
    ctx.closePath();
    ctx.stroke();
  }

  ctx.setLineDash([]);
  const badgeR = Math.max(5, Math.min(7, (yLow - yHigh) * 0.18));
  const badgeCx = x2 - d * 0.55;
  const badgeCy = yHigh + badgeR + 1;
  ctx.beginPath();
  ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1a1a1a';
  ctx.font = `bold ${Math.max(8, badgeR * 1.5)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('…', badgeCx, badgeCy + 0.5);
  ctx.restore();
}
