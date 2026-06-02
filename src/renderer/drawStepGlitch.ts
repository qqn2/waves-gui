import type { BitState } from '../shared/types';

/** Whether a spurious-transition bump can be drawn for this step state. */
export function canDrawGlitch(st: BitState): boolean {
  return (
    st !== 'p' &&
    st !== 'n' &&
    st !== 'P' &&
    st !== 'N' &&
    st !== 'x'
  );
}

export function glitchOppositeY(
  st: BitState,
  yHigh: number,
  yLow: number,
  yMid: number,
): number {
  switch (st) {
    case '1':
      return yLow;
    case '0':
      return yHigh;
    case 'u':
      return yLow;
    case 'd':
      return yHigh;
    default:
      return yMid;
  }
}

/** WaveDrom-style notch at the end of a same-level step (into canvas path). */
export function appendGlitchToCanvasPath(
  ctx: CanvasRenderingContext2D,
  nextX: number,
  yHold: number,
  yOpp: number,
  tw: number,
): void {
  const xMid = nextX - tw * 0.5;
  const xBump = nextX - tw * 0.25;
  ctx.lineTo(xMid, yHold);
  ctx.lineTo(xBump, yOpp);
  ctx.lineTo(nextX, yHold);
}

/** Same geometry for SVG path `d` accumulation. */
export function appendGlitchToSvgPath(
  pathD: string,
  nextX: number,
  yHold: number,
  yOpp: number,
  tw: number,
): string {
  const xMid = nextX - tw * 0.5;
  const xBump = nextX - tw * 0.25;
  return `${pathD} L${xMid},${yHold} L${xBump},${yOpp} L${nextX},${yHold}`;
}

/** Legacy overlay stroke (export fallback). */
export function drawStepGlitch(
  ctx: CanvasRenderingContext2D,
  xEdge: number,
  yHold: number,
  yOpp: number,
  halfWidth: number,
  stroke: string,
): void {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(xEdge - halfWidth, yHold);
  ctx.lineTo(xEdge - halfWidth * 0.5, yOpp);
  ctx.lineTo(xEdge, yHold);
  ctx.stroke();
  ctx.restore();
}

export function svgStepGlitch(
  xEdge: number,
  yHold: number,
  yOpp: number,
  halfWidth: number,
  stroke: string,
): string {
  const x1 = xEdge - halfWidth;
  const xm = xEdge - halfWidth * 0.5;
  return `<path d="M${x1},${yHold} L${xm},${yOpp} L${xEdge},${yHold}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
}

/** Small marker at a glitch boundary (glitch tool / inspection). */
export function drawGlitchBoundaryMarker(
  ctx: CanvasRenderingContext2D,
  xEdge: number,
  yHigh: number,
  yLow: number,
  active: boolean,
): void {
  const yMid = (yHigh + yLow) / 2;
  const r = 3;
  ctx.save();
  ctx.fillStyle = active
    ? 'var(--accent, #e8a838)'
    : 'var(--text-muted, #888)';
  ctx.beginPath();
  ctx.moveTo(xEdge, yMid - r * 1.8);
  ctx.lineTo(xEdge - r, yMid + r);
  ctx.lineTo(xEdge + r, yMid + r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
