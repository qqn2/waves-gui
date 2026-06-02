import type { BitState, Signal } from '../shared/types';
import { TRACE_PADDING, TRANSITION_WIDTH } from '../shared/constants';
import type { ViewTransform } from './coordinates';
import { logicalToCanvasY } from './coordinates';
import { drawStepGap } from './drawStepGap';
import { stepLogicalX, stepLogicalXEnd } from './laneTiming';
import { stateStrokeColor, X_FILL, X_STROKE, zStrokeColor } from './stateColors';

function stateToY(
  bitState: BitState,
  yHigh: number,
  yLow: number,
  yMid: number,
): number {
  switch (bitState) {
    case '1':
      return yHigh;
    case '0':
      return yLow;
    case 'z':
      return yMid;
    case 'u':
      return yHigh + 4;
    case 'd':
      return yLow - 4;
    default:
      return yMid;
  }
}

function createXHatchPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const tile = document.createElement('canvas');
  tile.width = 8;
  tile.height = 8;
  const tctx = tile.getContext('2d');
  if (!tctx) return null;
  tctx.strokeStyle = X_STROKE;
  tctx.lineWidth = 1;
  tctx.beginPath();
  tctx.moveTo(0, 8);
  tctx.lineTo(8, 0);
  tctx.stroke();
  return ctx.createPattern(tile, 'repeat');
}

function drawClockStep(
  ctx: CanvasRenderingContext2D,
  st: 'p' | 'n',
  x0: number,
  x1: number,
  yHigh: number,
  yLow: number,
): void {
  const xMid = (x0 + x1) / 2;
  ctx.beginPath();
  if (st === 'p') {
    ctx.moveTo(x0, yHigh);
    ctx.lineTo(xMid, yHigh);
    ctx.lineTo(xMid, yLow);
    ctx.lineTo(x1, yLow);
  } else {
    ctx.moveTo(x0, yLow);
    ctx.lineTo(xMid, yLow);
    ctx.lineTo(xMid, yHigh);
    ctx.lineTo(x1, yHigh);
  }
  ctx.stroke();
}

export function renderBitSignal(
  ctx: CanvasRenderingContext2D,
  signal: Signal,
  rowYLogical: number,
  rowHeightLogical: number,
  transform: ViewTransform,
  totalSteps: number,
  draftStates?: BitState[] | null,
): void {
  const states = draftStates ?? signal.states;
  const scale = transform.zoom * transform.hscale;
  const tw = TRANSITION_WIDTH * scale;
  const gapStroke =
    getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() ||
    '#888';

  const rowY = logicalToCanvasY(rowYLogical, transform);
  const rowH = rowHeightLogical * transform.zoom;
  const yHigh = rowY + TRACE_PADDING * transform.zoom;
  const yLow = rowY + rowH - TRACE_PADDING * transform.zoom;
  const yMid = rowY + rowH / 2;

  const hatch = createXHatchPattern(ctx);

  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.strokeStyle = stateStrokeColor('1', signal.color);
  ctx.beginPath();

  let prevY = stateToY(states[0] ?? '0', yHigh, yLow, yMid);
  let pathOpen = true;
  ctx.moveTo(stepLogicalX(signal, 0) * scale - transform.scrollX, prevY);

  for (let i = 0; i < totalSteps; i++) {
    const st = states[i] ?? '0';
    const x = stepLogicalX(signal, i) * scale - transform.scrollX;
    const nextX = stepLogicalXEnd(signal, i) * scale - transform.scrollX;

    if (st === 'p' || st === 'n') {
      if (pathOpen) {
        ctx.stroke();
        pathOpen = false;
      }
      ctx.strokeStyle = signal.color;
      drawClockStep(ctx, st, x, nextX, yHigh, yLow);
      prevY = st === 'p' ? yLow : yHigh;
      continue;
    }

    if (st === 'x') {
      if (pathOpen) {
        ctx.stroke();
        ctx.beginPath();
        pathOpen = false;
      }
      continue;
    }

    if (st === 'z') {
      if (pathOpen) {
        ctx.stroke();
        pathOpen = false;
      }
      ctx.save();
      ctx.strokeStyle = zStrokeColor(signal.color);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, yMid);
      ctx.lineTo(nextX, yMid);
      ctx.stroke();
      ctx.restore();
      prevY = yMid;
      continue;
    }

    if (!pathOpen) {
      ctx.beginPath();
      ctx.moveTo(x, prevY);
      pathOpen = true;
      ctx.strokeStyle = stateStrokeColor(st, signal.color);
    }

    const y = stateToY(st, yHigh, yLow, yMid);
    if (y !== prevY) {
      ctx.lineTo(x + tw / 2, prevY);
      ctx.lineTo(x + tw, y);
    }
    ctx.lineTo(nextX, y);
    prevY = y;
  }

  if (pathOpen) ctx.stroke();

  const gaps = signal.stepGaps ?? [];
  for (let i = 0; i < gaps.length; i++) {
    if (!gaps[i]) continue;
    const x1 = stepLogicalXEnd(signal, i) * scale - transform.scrollX;
    const x2 = stepLogicalX(signal, i + 1) * scale - transform.scrollX;
    drawStepGap(ctx, x1, x2, yHigh, yLow, gapStroke);
  }

  for (let i = 0; i < totalSteps; i++) {
    if ((states[i] ?? '0') !== 'x') continue;
    const x1 = stepLogicalX(signal, i) * scale - transform.scrollX;
    const x2 = stepLogicalXEnd(signal, i) * scale - transform.scrollX;
    ctx.fillStyle = hatch ?? X_FILL;
    ctx.fillRect(x1, yHigh, x2 - x1, yLow - yHigh);
    ctx.strokeStyle = X_STROKE;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, yHigh);
    ctx.lineTo(x2, yHigh);
    ctx.moveTo(x1, yLow);
    ctx.lineTo(x2, yLow);
    ctx.stroke();
  }
}
