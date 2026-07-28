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
  resolveSignalColor,
} from './stateColors';
import {
  clockCycleEndY,
  clockLevelEndY,
  isClockLevelState,
  strokeClockCycle,
  strokeClockLevel,
} from './drawClock';
import { fillHexForWaveChar } from '../shared/vectorSegments';

function isExtendedDataState(state: BitState): boolean {
  return state === 'x' || state === 'X' || state === '='
    || (state >= '2' && state <= '9');
}

function isExtendedTransientState(state: BitState): boolean {
  return state === 'i' || state === 'I' || state === 'm' || state === 'M';
}

function drawDataCell(
  ctx: CanvasRenderingContext2D,
  state: BitState,
  x: number,
  nextX: number,
  yHigh: number,
  yLow: number,
  hatch: CanvasPattern | null,
  bevel: number,
): void {
  const d = Math.min(bevel, Math.max(1, (nextX - x) * 0.2));
  ctx.beginPath();
  ctx.moveTo(x, (yHigh + yLow) / 2);
  ctx.lineTo(x + d, yHigh);
  ctx.lineTo(nextX - d, yHigh);
  ctx.lineTo(nextX, (yHigh + yLow) / 2);
  ctx.lineTo(nextX - d, yLow);
  ctx.lineTo(x + d, yLow);
  ctx.closePath();
  if (state === 'x' || state === 'X') {
    ctx.fillStyle = hatch ?? X_FILL;
    ctx.strokeStyle = X_STROKE;
  } else {
    ctx.fillStyle = fillHexForWaveChar(state) ?? '#ffffff';
    ctx.strokeStyle = '#6b7280';
  }
  ctx.fill();
  ctx.stroke();
}

function drawRelaxedDigitalCell(
  ctx: CanvasRenderingContext2D,
  state: 'z' | 'u' | 'd',
  x: number,
  nextX: number,
  previousY: number,
  yHigh: number,
  yLow: number,
  yMid: number,
  slewPx: number,
  scale: number,
  color: string,
): number {
  const targetY = state === 'z' ? yMid : state === 'u' ? yHigh : yLow;
  const span = Math.max(1, yLow - yHigh);
  const dt = Math.abs(targetY - previousY) * slewPx / span;
  const settleX = Math.min(nextX, x + 20 * scale);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x, previousY);
  if (state === 'z') {
    ctx.bezierCurveTo(x + dt, targetY, x + dt, targetY, settleX, targetY);
  } else {
    ctx.bezierCurveTo(x, previousY, x + dt, targetY, settleX, targetY);
  }
  ctx.lineTo(nextX, targetY);
  ctx.stroke();
  ctx.restore();
  return targetY;
}

function drawTransientCell(
  ctx: CanvasRenderingContext2D,
  state: BitState,
  x: number,
  nextX: number,
  yHigh: number,
  yLow: number,
  previousY: number,
  color: string,
  slewPx: number,
  dutyCycle: number,
): number {
  const width = nextX - x;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, previousY);

  if (state === 'i' || state === 'I') {
    const baseY = state === 'i' ? yHigh : yLow;
    const pulseY = state === 'i' ? yLow : yHigh;
    const pulseX = x + width * Math.max(0, Math.min(1, dutyCycle));
    const span = Math.max(1, yLow - yHigh);
    const settleX = Math.min(
      pulseX,
      x + Math.abs(baseY - previousY) * slewPx / span,
    );
    ctx.lineTo(settleX, baseY);
    ctx.lineTo(pulseX, baseY);
    ctx.lineTo(pulseX, pulseY);
    ctx.lineTo(pulseX, baseY);
    ctx.lineTo(nextX, baseY);
    ctx.stroke();
    ctx.restore();
    return baseY;
  }

  const resolvesHigh = state === 'M';
  const samples = 28;
  for (let sample = 0; sample <= samples; sample++) {
    const t = (sample / samples) * 0.75;
    const amplitude = Math.exp(2 * (t - 1));
    const phase = resolvesHigh ? Math.PI : 0;
    const normalized = (1 + amplitude * Math.sin(phase + 8 * Math.PI * t)) / 2;
    ctx.lineTo(x + t * width, yHigh + normalized * (yLow - yHigh));
  }
  const targetY = resolvesHigh ? yHigh : yLow;
  ctx.bezierCurveTo(
    x + width * 0.85,
    targetY,
    x + width * 0.9,
    targetY,
    nextX,
    targetY,
  );
  ctx.stroke();
  ctx.restore();
  return targetY;
}

function stateToY(
  bitState: BitState,
  yHigh: number,
  yLow: number,
  yMid: number,
): number {
  switch (bitState) {
    case '1':
    case 'h':
    case 'H':
      return yHigh;
    case '0':
    case 'l':
    case 'L':
      return yLow;
    case 'z':
      return yMid;
    case 'u':
      return yHigh;
    case 'd':
      return yLow;
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
  const extendedDigital = states.some(
    (state) => state === 'X' || state === '='
      || (state >= '2' && state <= '9')
      || state === 'u' || state === 'd'
      || isClockLevelState(state)
      || isExtendedTransientState(state),
  );
  const slewLogical = signal.digitalTiming?.slewing !== undefined
    ? Math.max(0, signal.digitalTiming.slewing)
    : extendedDigital ? 0 : TRANSITION_WIDTH;
  const clockSlewLogical = Math.max(0, signal.digitalTiming?.slewing ?? 0);
  const tw = slewLogical * scale;
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
  let resumeAtCurrentState = false;
  ctx.moveTo(stepLogicalX(signal, 0) * scale - transform.scrollX, prevY);

  for (let i = 0; i < totalSteps; i++) {
    const st = states[i] ?? '0';
    const x = stepLogicalX(signal, i) * scale - transform.scrollX;
    const nextX = stepLogicalXEnd(signal, i) * scale - transform.scrollX;

    if (extendedDigital && isExtendedDataState(st)) {
      if (pathOpen) {
        ctx.stroke();
        pathOpen = false;
      }
      let runEnd = i + 1;
      while (
        runEnd < totalSteps
        && states[runEnd] === st
        && !signal.stepGaps?.[runEnd]
      ) {
        runEnd++;
      }
      const dataNextX =
        stepLogicalXEnd(signal, runEnd - 1) * scale - transform.scrollX;
      drawDataCell(ctx, st, x, dataNextX, yHigh, yLow, hatch, 3 * scale);
      i = runEnd - 1;
      resumeAtCurrentState = true;
      continue;
    }

    if (isExtendedTransientState(st)) {
      if (pathOpen) {
        ctx.stroke();
        pathOpen = false;
      }
      prevY = drawTransientCell(
        ctx,
        st,
        x,
        nextX,
        yHigh,
        yLow,
        resumeAtCurrentState ? yMid : prevY,
        resolveSignalColor(signal.color),
        clockSlewLogical * scale,
        signal.digitalTiming?.cells[i]?.dutyTicks === undefined
          ? 0.5
          : signal.digitalTiming.cells[i]!.dutyTicks!
            / signal.digitalTiming.cells[i]!.durationTicks,
      );
      resumeAtCurrentState = false;
      continue;
    }

    if (isClockLevelState(st)) {
      if (pathOpen) {
        ctx.stroke();
        pathOpen = false;
      }
      ctx.strokeStyle = resolveSignalColor(signal.color);
      const targetY = clockLevelEndY(st, yHigh, yLow);
      strokeClockLevel(
        ctx,
        st,
        x,
        nextX,
        resumeAtCurrentState ? targetY : prevY,
        yHigh,
        yLow,
        ctx.lineWidth,
        i > 0,
        clockSlewLogical * scale,
      );
      prevY = targetY;
      resumeAtCurrentState = false;
      continue;
    }

    if (st === 'p' || st === 'n' || st === 'P' || st === 'N') {
      if (pathOpen) {
        ctx.stroke();
        pathOpen = false;
      }
      ctx.strokeStyle = resolveSignalColor(signal.color);
      const timingCell = signal.digitalTiming?.cells[i];
      strokeClockCycle(
        ctx,
        st,
        x,
        nextX,
        yHigh,
        yLow,
        ctx.lineWidth,
        timingCell?.dutyTicks === undefined
          ? 0.5
          : timingCell.dutyTicks / timingCell.durationTicks,
        clockSlewLogical * scale,
      );
      prevY = clockCycleEndY(st, yHigh, yLow);
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

    if (st === 'z' || st === 'u' || st === 'd') {
      if (pathOpen) {
        ctx.stroke();
        pathOpen = false;
      }
      prevY = drawRelaxedDigitalCell(
        ctx,
        st,
        x,
        nextX,
        resumeAtCurrentState ? yMid : prevY,
        yHigh,
        yLow,
        yMid,
        slewLogical * scale,
        scale,
        resolveSignalColor(signal.color),
      );
      resumeAtCurrentState = false;
      continue;
    }

    if (!pathOpen) {
      ctx.beginPath();
      const y = stateToY(st, yHigh, yLow, yMid);
      if (resumeAtCurrentState) prevY = y;
      ctx.moveTo(x, prevY);
      pathOpen = true;
      resumeAtCurrentState = false;
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
    if (extendedDigital) break;
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

  // WaveDrom's `|` is a held column with a gap symbol overlaid on the trace.
  // Draw it last so the narrow mask breaks the line without erasing the cycle.
  for (let i = 0; i < totalSteps; i++) {
    if (!signal.stepGaps?.[i]) continue;
    const x1 = stepLogicalX(signal, i) * scale - transform.scrollX;
    const x2 = stepLogicalXEnd(signal, i) * scale - transform.scrollX;
    drawStepGap(ctx, x1, x2, yHigh, yLow, gapStroke, gapFill);
  }
}
