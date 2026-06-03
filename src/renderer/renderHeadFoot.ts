import type { DiagramConfig } from '../shared/types';
import { TIME_AXIS_HEIGHT } from '../shared/constants';
import { canvasCellWidth, type ViewTransform } from './coordinates';

const HEAD_TEXT_BAND = 20;
const HEAD_TICK_BAND = 16;
const FOOT_TEXT_BAND = 20;
const FOOT_TOCK_BAND = 16;
const BAND_PAD = 4;

export interface HeadFootLayout {
  headHeight: number;
  footHeight: number;
}

function headHasTickBand(head: DiagramConfig['head']): boolean {
  return head?.tick !== undefined || head?.every !== undefined;
}

function footHasTockBand(foot: DiagramConfig['foot']): boolean {
  return foot?.tock !== undefined || foot?.every !== undefined;
}

/** Vertical space reserved above signal rows (below optional time axis). */
export function measureHeadFoot(config: DiagramConfig): HeadFootLayout {
  let headHeight = 0;
  let footHeight = 0;

  if (config.head?.text) {
    headHeight += HEAD_TEXT_BAND + BAND_PAD;
  }
  if (headHasTickBand(config.head)) {
    headHeight += HEAD_TICK_BAND;
  }

  if (config.foot?.text) {
    footHeight += FOOT_TEXT_BAND + BAND_PAD;
  }
  if (footHasTockBand(config.foot)) {
    footHeight += FOOT_TOCK_BAND;
  }

  return { headHeight, footHeight };
}

/** WaveDrom-style numeric tick/tock labels for each step column. */
export function buildStepLabels(
  offset: number | undefined,
  every: number | undefined,
  totalSteps: number,
): string[] {
  if (offset === undefined && every === undefined) {
    return [];
  }
  const base = offset ?? 0;
  const labels: string[] = [];
  for (let i = 0; i < totalSteps; i++) {
    const val = i + base;
    if (every !== undefined && every > 0 && val % every !== 0) {
      labels.push('');
    } else {
      labels.push(String(val));
    }
  }
  return labels;
}

function cssVar(name: string, fallback: string): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  diagramWidth: number,
  scrollX: number,
  canvasWidth: number,
): void {
  ctx.save();
  ctx.fillStyle = cssVar('--text-primary', '#eee');
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const centerX = diagramWidth / 2 - scrollX;
  const clipLeft = 0;
  const clipRight = canvasWidth;
  if (centerX >= clipLeft - diagramWidth && centerX <= clipRight + diagramWidth) {
    ctx.fillText(text, centerX, y);
  }
  ctx.restore();
}

function drawStepScale(
  ctx: CanvasRenderingContext2D,
  labels: string[],
  y: number,
  transform: ViewTransform,
  totalSteps: number,
  canvasWidth: number,
  halfStepOffset: boolean,
): void {
  const cellWidth = canvasCellWidth(transform.hscale, transform.zoom);
  const { scrollX } = transform;
  const x0 = halfStepOffset ? cellWidth / 2 : 0;

  ctx.save();
  ctx.fillStyle = cssVar('--text-secondary', '#999');
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const start = Math.max(0, Math.floor((scrollX - x0) / cellWidth));
  const end = Math.min(totalSteps, Math.ceil((scrollX + canvasWidth - x0) / cellWidth));

  for (let i = start; i < end; i++) {
    const label = labels[i];
    if (!label) continue;
    const x = x0 + i * cellWidth + cellWidth / 2 - scrollX;
    ctx.fillText(label, x, y);
  }
  ctx.restore();
}

/**
 * Draw diagram title (head) and caption (foot) per WaveDrom tutorial layout.
 * @param headTopY Canvas Y where the head band starts (below time axis).
 * @param footTopY Canvas Y where the foot band starts (below signal content).
 */
export function renderHeadFoot(
  ctx: CanvasRenderingContext2D,
  config: DiagramConfig,
  transform: ViewTransform,
  totalSteps: number,
  canvasWidth: number,
  headTopY: number,
  footTopY: number,
): void {
  const cellWidth = canvasCellWidth(transform.hscale, transform.zoom);
  const diagramWidth = totalSteps * cellWidth;

  let y = headTopY + BAND_PAD;

  if (config.head?.text) {
    drawCaption(
      ctx,
      config.head.text,
      y + HEAD_TEXT_BAND / 2,
      diagramWidth,
      transform.scrollX,
      canvasWidth,
    );
    y += HEAD_TEXT_BAND + BAND_PAD;
  }

  if (headHasTickBand(config.head)) {
    const labels = buildStepLabels(config.head?.tick, config.head?.every, totalSteps);
    drawStepScale(ctx, labels, y + HEAD_TICK_BAND / 2, transform, totalSteps, canvasWidth, false);
    y += HEAD_TICK_BAND;
  }

  let fy = footTopY + BAND_PAD;

  if (config.foot?.text) {
    drawCaption(
      ctx,
      config.foot.text,
      fy + FOOT_TEXT_BAND / 2,
      diagramWidth,
      transform.scrollX,
      canvasWidth,
    );
    fy += FOOT_TEXT_BAND + BAND_PAD;
  }

  if (footHasTockBand(config.foot)) {
    const labels = buildStepLabels(config.foot?.tock, config.foot?.every, totalSteps);
    drawStepScale(ctx, labels, fy + FOOT_TOCK_BAND / 2, transform, totalSteps, canvasWidth, true);
  }
}

/** Canvas Y offset (px) where the first signal row is drawn — below time axis and head text. */
export function getWaveformTopInsetPx(
  config: DiagramConfig,
  showTimeAxis: boolean,
): number {
  const axis = showTimeAxis ? TIME_AXIS_HEIGHT : 0;
  const { headHeight } = measureHeadFoot(config);
  return axis + headHeight;
}
