import type { Signal } from '../shared/types';
import { TRACE_PADDING, TRANSITION_WIDTH } from '../shared/constants';
import type { ViewTransform } from './coordinates';
import { logicalToCanvasY } from './coordinates';
import { drawStepGap } from './drawStepGap';
import { stepLogicalX, stepLogicalXEnd } from './laneTiming';
import {
  stateLineDash,
  stateStrokeColor,
  X_FILL,
  X_STROKE,
  zStrokeColor,
  resolveSignalColor,
} from './stateColors';
import { strokeClockStep, clockStepEndY } from './drawClock';
import {
  expandWaveToColumns,
  padWaveColumns,
  type LaneLevel,
  type WaveColumnDraw,
} from '../wavedromBridge/subcycleWave';

function levelToY(
  level: LaneLevel,
  yHigh: number,
  yLow: number,
  yMid: number,
): number {
  switch (level) {
    case '1': return yHigh;
    case '0': return yLow;
    case 'z': return yMid;
    case 'u': return yHigh + 4;
    case 'd': return yLow - 4;
    case 'p':
    case 'P': return yHigh;
    case 'n':
    case 'N': return yLow;
    default: return yMid;
  }
}

function isClockLevel(level: LaneLevel): boolean {
  return level === 'p' || level === 'n' || level === 'P' || level === 'N';
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

function drawColumnLevels(
  ctx: CanvasRenderingContext2D,
  signal: Signal,
  column: WaveColumnDraw,
  x: number,
  nextX: number,
  yHigh: number,
  yLow: number,
  yMid: number,
  tw: number,
): void {
  const levels = column.levels;
  if (levels.length === 0) return;

  const span = nextX - x;
  if (levels.length === 1 && isClockLevel(levels[0]!)) {
    ctx.strokeStyle = resolveSignalColor(signal.color);
    strokeClockStep(ctx, levels[0]!, x, nextX, yHigh, yLow, ctx.lineWidth);
    return;
  }

  if (levels.length === 1 && levels[0] === 'x') return;
  if (levels.length === 1 && levels[0] === 'z') {
    ctx.save();
    ctx.strokeStyle = zStrokeColor(signal.color);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, yMid);
    ctx.lineTo(nextX, yMid);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const subW = span / levels.length;
  let prevY = levelToY(levels[0]!, yHigh, yLow, yMid);
  ctx.strokeStyle = stateStrokeColor(levels[0]!, signal.color);
  ctx.setLineDash(stateLineDash(levels[0]!) ?? []);
  ctx.beginPath();
  ctx.moveTo(x, prevY);

  for (let s = 0; s < levels.length; s++) {
    const level = levels[s]!;
    const sx = x + s * subW;
    const sxEnd = x + (s + 1) * subW;
    const y = levelToY(level, yHigh, yLow, yMid);

    if (isClockLevel(level)) {
      ctx.stroke();
      ctx.strokeStyle = resolveSignalColor(signal.color);
      ctx.setLineDash([]);
      strokeClockStep(ctx, level, sx, sxEnd, yHigh, yLow, ctx.lineWidth);
      prevY = clockStepEndY(level, yHigh, yLow);
      ctx.beginPath();
      ctx.moveTo(sxEnd, prevY);
      continue;
    }

    if (level === 'x') {
      ctx.stroke();
      ctx.beginPath();
      prevY = yMid;
      continue;
    }

    if (level === 'z') {
      ctx.stroke();
      ctx.save();
      ctx.strokeStyle = zStrokeColor(signal.color);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, yMid);
      ctx.lineTo(sxEnd, yMid);
      ctx.stroke();
      ctx.restore();
      prevY = yMid;
      ctx.beginPath();
      ctx.moveTo(sxEnd, prevY);
      ctx.strokeStyle = stateStrokeColor(level, signal.color);
      continue;
    }

    const localTw = Math.min(tw, subW * 0.35);
    if (y !== prevY) {
      ctx.lineTo(sx + localTw / 2, prevY);
      ctx.lineTo(sx + localTw, y);
    }
    ctx.lineTo(sxEnd, y);
    prevY = y;
  }
  ctx.stroke();
}

/** Draw a bit lane from WaveDrom sub-cycle waveOverride (native canvas parity with preview). */
export function renderSubcycleBitSignal(
  ctx: CanvasRenderingContext2D,
  signal: Signal,
  wave: string,
  rowYLogical: number,
  rowHeightLogical: number,
  transform: ViewTransform,
  totalSteps: number,
  hscale: number,
): void {
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

  const columns = padWaveColumns(
    expandWaveToColumns(wave, hscale, signal.period ?? 1),
    totalSteps,
  );

  const hatch = createXHatchPattern(ctx);
  ctx.lineWidth = 2;

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!;
    const x = stepLogicalX(signal, i) * scale - transform.scrollX;
    const nextX = stepLogicalXEnd(signal, i) * scale - transform.scrollX;

    drawColumnLevels(ctx, signal, col, x, nextX, yHigh, yLow, yMid, tw);

    if (col.levels.length === 1 && col.levels[0] === 'x') {
      ctx.fillStyle = hatch ?? X_FILL;
      ctx.fillRect(x, yHigh, nextX - x, yLow - yHigh);
      ctx.strokeStyle = X_STROKE;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(nextX, yHigh);
      ctx.moveTo(x, yLow);
      ctx.lineTo(nextX, yLow);
      ctx.stroke();
    }

    if (col.gapAfter && i + 1 < columns.length) {
      drawStepGap(ctx, nextX, nextX, yHigh, yLow, gapStroke, gapFill);
    }
  }
}
