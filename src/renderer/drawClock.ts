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

/** Undulate h/H/l/L: transition at the cell start, then hold the target level. */
export function isClockLevelState(st: BitState): boolean {
  return st === 'h' || st === 'H' || st === 'l' || st === 'L';
}

function clockLevelIsHigh(st: BitState): boolean {
  return st === 'h' || st === 'H';
}

function clockLevelHasArrow(st: BitState): boolean {
  return st === 'H' || st === 'L';
}

export function clockLevelEndY(
  st: BitState,
  yHigh: number,
  yLow: number,
): number {
  return clockLevelIsHigh(st) ? yHigh : yLow;
}

export function strokeClockLevel(
  ctx: CanvasRenderingContext2D,
  st: BitState,
  x0: number,
  x1: number,
  previousY: number,
  yHigh: number,
  yLow: number,
  lineWidth: number,
  allowArrow: boolean,
): void {
  const targetY = clockLevelEndY(st, yHigh, yLow);
  ctx.beginPath();
  ctx.moveTo(x0, previousY);
  if (previousY !== targetY) ctx.lineTo(x0, targetY);
  ctx.lineTo(x1, targetY);
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  if (allowArrow && clockLevelHasArrow(st) && previousY !== targetY) {
    const prevFill = ctx.fillStyle;
    ctx.fillStyle = ctx.strokeStyle;
    const span = yLow - yHigh;
    const points = clockArrowPoints(
      clockLevelIsHigh(st),
      x0,
      yHigh,
      yLow,
      Math.max(2, lineWidth * 1.5),
      Math.min(6, span * 0.22),
    );
    ctx.beginPath();
    ctx.moveTo(points.tipX, points.tipY);
    ctx.lineTo(points.x1, points.y1);
    ctx.lineTo(points.x2, points.y2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = prevFill;
  }
}

export function clockLevelSvg(
  st: BitState,
  x0: number,
  x1: number,
  previousY: number,
  yHigh: number,
  yLow: number,
  color: string,
  allowArrow: boolean,
): string[] {
  const targetY = clockLevelEndY(st, yHigh, yLow);
  const d = previousY === targetY
    ? `M${x0},${targetY} L${x1},${targetY}`
    : `M${x0},${previousY} L${x0},${targetY} L${x1},${targetY}`;
  const parts = [
    `<path data-wave-state="${st}" d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`,
  ];
  if (allowArrow && clockLevelHasArrow(st) && previousY !== targetY) {
    const span = yLow - yHigh;
    const points = clockArrowPoints(
      clockLevelIsHigh(st),
      x0,
      yHigh,
      yLow,
      3,
      Math.min(4, span * 0.22),
    );
    parts.push(
      `<polygon data-wave-state="${st}-arrow" points="${points.tipX},${points.tipY} ${points.x1},${points.y1} ${points.x2},${points.y2}" fill="${color}"/>`,
    );
  }
  return parts;
}

/** Draw one complete WaveDrom clock cycle inside a timeline column. */
export function strokeClockCycle(
  ctx: CanvasRenderingContext2D,
  st: BitState,
  x0: number,
  x1: number,
  yHigh: number,
  yLow: number,
  lineWidth: number,
  dutyCycle = 0.5,
): void {
  const riseFirst = isClockRiseStep(st);
  const mid = x0 + (x1 - x0) * Math.max(0, Math.min(1, dutyCycle));
  ctx.beginPath();
  if (riseFirst) {
    ctx.moveTo(x0, yLow);
    ctx.lineTo(x0, yHigh);
    ctx.lineTo(mid, yHigh);
    ctx.lineTo(mid, yLow);
    ctx.lineTo(x1, yLow);
  } else {
    ctx.moveTo(x0, yHigh);
    ctx.lineTo(x0, yLow);
    ctx.lineTo(mid, yLow);
    ctx.lineTo(mid, yHigh);
    ctx.lineTo(x1, yHigh);
  }
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  if (clockStepHasArrow(st)) {
    const prevFill = ctx.fillStyle;
    ctx.fillStyle = ctx.strokeStyle;
    const span = yLow - yHigh;
    const w = Math.max(2, lineWidth * 1.5);
    const h = Math.min(6, span * 0.22);
    const points = clockArrowPoints(riseFirst, x0, yHigh, yLow, w, h);
    ctx.beginPath();
    ctx.moveTo(points.tipX, points.tipY);
    ctx.lineTo(points.x1, points.y1);
    ctx.lineTo(points.x2, points.y2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = prevFill;
  }
}

export function clockCycleEndY(st: BitState, yHigh: number, yLow: number): number {
  return isClockRiseStep(st) ? yLow : yHigh;
}

export function clockCycleSvg(
  st: BitState,
  x0: number,
  x1: number,
  yHigh: number,
  yLow: number,
  color: string,
  dutyCycle = 0.5,
): string[] {
  const riseFirst = isClockRiseStep(st);
  const mid = x0 + (x1 - x0) * Math.max(0, Math.min(1, dutyCycle));
  const d = riseFirst
    ? `M${x0},${yLow} L${x0},${yHigh} L${mid},${yHigh} L${mid},${yLow} L${x1},${yLow}`
    : `M${x0},${yHigh} L${x0},${yLow} L${mid},${yLow} L${mid},${yHigh} L${x1},${yHigh}`;
  const parts = [`<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`];
  if (clockStepHasArrow(st)) {
    const span = yLow - yHigh;
    const points = clockArrowPoints(riseFirst, x0, yHigh, yLow, 3, Math.min(4, span * 0.22));
    parts.push(
      `<polygon points="${points.tipX},${points.tipY} ${points.x1},${points.y1} ${points.x2},${points.y2}" fill="${color}"/>`,
    );
  }
  return parts;
}
