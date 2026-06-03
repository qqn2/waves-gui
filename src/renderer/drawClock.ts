import type { BitState } from '../shared/types';

/** Rising = low→high at step start (WaveDrom `pclk`); falling = high→low (`nclk`). */
export function isClockRiseStep(st: BitState): boolean {
  return st === 'p' || st === 'P';
}

export function clockStepHasArrow(st: BitState): boolean {
  return st === 'P' || st === 'N';
}

/** Triangle on the vertical transition, centered and pointing along the edge (WaveDrom P/N). */
export function clockArrowPoints(
  rise: boolean,
  x0: number,
  yHigh: number,
  yLow: number,
  w: number,
  h: number,
): { tipX: number; tipY: number; x1: number; y1: number; x2: number; y2: number } {
  const tipX = x0;
  const yMid = (yHigh + yLow) / 2;
  if (rise) {
    return {
      tipX,
      tipY: yMid - h,
      x1: tipX - w,
      y1: yMid + h * 0.5,
      x2: tipX + w,
      y2: yMid + h * 0.5,
    };
  }
  return {
    tipX,
    tipY: yMid + h,
    x1: tipX - w,
    y1: yMid - h * 0.5,
    x2: tipX + w,
    y2: yMid - h * 0.5,
  };
}

/**
 * One timing step: vertical edge at x0, then hold to x1.
 * Arrow on P (posedge) or N (negedge) at the vertical edge only.
 */
export function strokeClockStep(
  ctx: CanvasRenderingContext2D,
  st: BitState,
  x0: number,
  x1: number,
  yHigh: number,
  yLow: number,
  lineWidth: number,
): void {
  const rise = isClockRiseStep(st);
  ctx.beginPath();
  if (rise) {
    ctx.moveTo(x0, yLow);
    ctx.lineTo(x0, yHigh);
    ctx.lineTo(x1, yHigh);
  } else {
    ctx.moveTo(x0, yHigh);
    ctx.lineTo(x0, yLow);
    ctx.lineTo(x1, yLow);
  }
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  if (clockStepHasArrow(st)) {
    const prevFill = ctx.fillStyle;
    ctx.fillStyle = ctx.strokeStyle;
    const span = yLow - yHigh;
    const w = Math.max(2, lineWidth * 1.5);
    const h = Math.min(6, span * 0.22);
    const { tipX, tipY, x1, y1, x2, y2 } = clockArrowPoints(
      rise,
      x0,
      yHigh,
      yLow,
      w,
      h,
    );
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = prevFill;
  }
}

export function clockStepEndY(
  st: BitState,
  yHigh: number,
  yLow: number,
): number {
  return isClockRiseStep(st) ? yHigh : yLow;
}

export function clockStepSvg(
  st: BitState,
  x: number,
  nextX: number,
  yHigh: number,
  yLow: number,
  color: string,
): string[] {
  const rise = isClockRiseStep(st);
  const parts: string[] = [];
  const d = rise
    ? `M${x},${yLow} L${x},${yHigh} L${nextX},${yHigh}`
    : `M${x},${yHigh} L${x},${yLow} L${nextX},${yLow}`;
  parts.push(
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`,
  );
  if (clockStepHasArrow(st)) {
    const span = yLow - yHigh;
    const w = 3;
    const h = Math.min(4, span * 0.22);
    const { tipX, tipY, x1, y1, x2, y2 } = clockArrowPoints(
      rise,
      x,
      yHigh,
      yLow,
      w,
      h,
    );
    parts.push(
      `<polygon points="${tipX},${tipY} ${x1},${y1} ${x2},${y2}" fill="${color}"/>`,
    );
  }
  return parts;
}
