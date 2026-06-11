import type { BitState, Signal } from '../shared/types';
import { TRACE_PADDING, TRANSITION_WIDTH } from '../shared/constants';
import type { ViewTransform } from './coordinates';
import { logicalToCanvasY } from './coordinates';
import { drawStepGap } from './drawStepGap';
import {
  appendGlitchToCanvasPath,
  canDrawGlitch,
  drawGlitchBoundaryMarker,
  glitchOppositeY,
} from './drawStepGlitch';
import { stepLogicalX, stepLogicalXEnd } from './laneTiming';
import {
  stateLineDash,
  stateStrokeColor,
  X_FILL,
  X_STROKE,
  zStrokeColor,
  resolveSignalColor,
} from './stateColors';
import { clockStepEndY, strokeClockStep } from './drawClock';

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
    case 'p':
    case 'P':
      return yHigh;
    case 'n':
    case 'N':
      return yLow;
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

export function renderBitSignal(
  ctx: CanvasRenderingContext2D,
  signal: Signal,
  rowYLogical: number,
  rowHeightLogical: number,
  transform: ViewTransform,
  totalSteps: number,
  draftStates?: BitState[] | null,
  options?: { highlightGlitchBoundaries?: boolean },
): void {
  const states = draftStates ?? signal.states;
  const glitches = signal.stepGlitches ?? [];
  const scale = transform.zoom * transform.hscale;
  const tw = TRANSITION_WIDTH * scale;
  const gapStroke =
    getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() ||
    '#e8e8e8';
  const gapFill =
    getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim() ||
    '#121212';

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

    if (signal.stepGaps?.[i]) {
      if (pathOpen) {
        ctx.stroke();
        pathOpen = false;
      }
      drawStepGap(ctx, x, nextX, yHigh, yLow, gapStroke, gapFill);
      continue;
    }

    if (st === 'p' || st === 'n' || st === 'P' || st === 'N') {
      if (pathOpen) {
        ctx.stroke();
        pathOpen = false;
      }
      ctx.strokeStyle = resolveSignalColor(signal.color);
      strokeClockStep(ctx, st, x, nextX, yHigh, yLow, ctx.lineWidth);
      prevY = clockStepEndY(st, yHigh, yLow);
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
      const resumeY =
        i > 0 && (signal.stepGaps?.[i - 1] ?? false)
          ? stateToY(st, yHigh, yLow, yMid)
          : prevY;
      ctx.moveTo(x, resumeY);
      pathOpen = true;
      prevY = resumeY;
      ctx.strokeStyle = stateStrokeColor(st, signal.color);
      const dash = stateLineDash(st);
      ctx.setLineDash(dash ?? []);
    }

    const y = stateToY(st, yHigh, yLow, yMid);
    if (y !== prevY) {
      ctx.lineTo(x + tw / 2, prevY);
      ctx.lineTo(x + tw, y);
    }
    if (glitches[i] && canDrawGlitch(st)) {
      appendGlitchToCanvasPath(
        ctx,
        nextX,
        y,
        glitchOppositeY(st, yHigh, yLow, yMid),
        tw,
      );
    } else {
      ctx.lineTo(nextX, y);
    }
    prevY = y;
  }

  if (pathOpen) ctx.stroke();

  if (options?.highlightGlitchBoundaries) {
    for (let i = 0; i < glitches.length; i++) {
      if (!glitches[i]) continue;
      const xEdge = stepLogicalXEnd(signal, i) * scale - transform.scrollX;
      drawGlitchBoundaryMarker(ctx, xEdge, yHigh, yLow, true);
    }
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
