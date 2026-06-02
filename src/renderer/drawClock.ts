import type { BitState } from '../shared/types';

/** Rising = low→high at step start (WaveDrom `pclk`); falling = high→low (`nclk`). */
export function isClockRiseStep(st: BitState): boolean {
  return st === 'p' || st === 'P';
}

export function clockStepHasArrow(st: BitState): boolean {
  return st === 'P' || st === 'N';
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
    const w = Math.max(2, lineWidth * 1.5);
    const h = Math.min(5, (yLow - yHigh) * 0.35);
    const tipX = x0 + 1;
    ctx.beginPath();
    if (rise) {
      ctx.moveTo(tipX, yHigh);
      ctx.lineTo(tipX - w, yHigh + h);
      ctx.lineTo(tipX + w, yHigh + h);
    } else {
      ctx.moveTo(tipX, yLow);
      ctx.lineTo(tipX - w, yLow - h);
      ctx.lineTo(tipX + w, yLow - h);
    }
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
    const w = 3;
    const h = 4;
    const tipX = x + 1;
    if (rise) {
      parts.push(
        `<polygon points="${tipX},${yHigh} ${tipX - w},${yHigh + h} ${tipX + w},${yHigh + h}" fill="${color}"/>`,
      );
    } else {
      parts.push(
        `<polygon points="${tipX},${yLow} ${tipX - w},${yLow - h} ${tipX + w},${yLow - h}" fill="${color}"/>`,
      );
    }
  }
  return parts;
}
