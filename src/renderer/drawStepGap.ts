/** WaveDrom `#gap` symbol paths (24px tall, centered on the column boundary). */
const GAP_MASK_PATH =
  'M7,-2 L3,-2 C-2,-2 -2,22 -7,22 L-3,22 C2,22 2,-2 7,-2 Z';
const GAP_STROKE_LEFT = 'M-7,22 C-2,22 -2,-2 3,-2';
const GAP_STROKE_RIGHT = 'M-3,22 C2,22 2,-2 7,-2';
const GAP_SYMBOL_HEIGHT = 24;

function canvasBackgroundFill(): string {
  if (typeof document === 'undefined') return '#121212';
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim() ||
    '#121212'
  );
}

function gapTransform(
  x1: number,
  x2: number,
  yHigh: number,
  yLow: number,
): { xEdge: number; yHigh: number; scale: number } {
  const xEdge = (x1 + x2) / 2;
  const bandH = Math.max(1, yLow - yHigh);
  return { xEdge, yHigh, scale: bandH / GAP_SYMBOL_HEIGHT };
}

/** WaveDrom `|` gap: canvas mask + paired discontinuity curves (not a plain vertical line). */
export function drawStepGap(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  yHigh: number,
  yLow: number,
  stroke: string,
  fill?: string,
): void {
  const { xEdge, yHigh: y0, scale } = gapTransform(x1, x2, yHigh, yLow);
  const maskFill = fill ?? canvasBackgroundFill();

  ctx.save();
  ctx.translate(xEdge, y0);
  ctx.scale(scale, scale);
  ctx.translate(0, -1);

  const path = new Path2D(GAP_MASK_PATH);
  ctx.fillStyle = maskFill;
  ctx.fill(path);

  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(1, 1 / scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const left = new Path2D(GAP_STROKE_LEFT);
  ctx.stroke(left);
  ctx.beginPath();
  const right = new Path2D(GAP_STROKE_RIGHT);
  ctx.stroke(right);

  ctx.restore();
}

export function svgStepGap(
  x1: number,
  x2: number,
  yHigh: number,
  yLow: number,
  stroke: string,
  fill?: string,
): string {
  const { xEdge, yHigh: y0, scale } = gapTransform(x1, x2, yHigh, yLow);
  const maskFill = fill ?? '#ffffff';
  const sw = Math.max(1, 1 / scale);
  return (
    `<g transform="translate(${xEdge},${y0}) scale(${scale}) translate(0,-1)">` +
    `<path d="${GAP_MASK_PATH}" fill="${maskFill}" stroke="none"/>` +
    `<path d="${GAP_STROKE_LEFT}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${GAP_STROKE_RIGHT}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</g>`
  );
}
