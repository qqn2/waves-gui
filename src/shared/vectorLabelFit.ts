import { BUS_DIAGONAL, CELL_WIDTH, HSCALE_STEP, MAX_HSCALE, MIN_HSCALE, ROW_HEIGHT, clampHscale } from './constants';
import type { Signal, VectorSegment } from './types';

const LABEL_PADDING = 8;
/** Extra character widths before treating a label as clipped (canvas compresses slightly). */
const OVERFLOW_CHAR_SLACK = 4;

export function busLabelFontPx(rowHeight = ROW_HEIGHT): number {
  return Math.max(10, rowHeight * 0.35);
}

export function labelOverflowSlackPx(fontPx: number, chars = OVERFLOW_CHAR_SLACK): number {
  return fontPx * 0.55 * chars;
}

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
  }
  return measureCtx;
}

export function measureBusLabelWidth(label: string, fontPx = busLabelFontPx()): number {
  const lines = label.split('\n');
  if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
    return 0;
  }
  const ctx = getMeasureCtx();
  if (ctx) {
    ctx.font = `${fontPx}px sans-serif`;
    return Math.max(
      ...lines.map((line) => {
        const w = ctx.measureText(line).width;
        return w > 0 ? w : line.length * fontPx * 0.6;
      }),
      0,
    );
  }
  return Math.max(...lines.map((line) => line.length * fontPx * 0.6), 0);
}

export function lanePeriod(signal: Signal): number {
  const p = signal.period;
  if (p === undefined || p < 1) return 1;
  return Math.floor(p);
}

export function stepSpanPx(
  spanSteps: number,
  signal: Signal,
  hscale: number,
): number {
  return spanSteps * CELL_WIDTH * hscale * lanePeriod(signal);
}

export function segmentSpanPx(
  segment: VectorSegment,
  signal: Signal,
  hscale: number,
): number {
  return stepSpanPx(segment.endStep - segment.startStep, signal, hscale);
}

export function segmentUsableLabelPx(spanPx: number, hscale: number): number {
  const diagonal = BUS_DIAGONAL * hscale;
  return Math.max(0, spanPx - 2 * diagonal - LABEL_PADDING);
}

/** Canvas skips the hex + label when span < BUS_DIAGONAL * hscale * 3. */
export function minStepsForBusShape(signal: Signal, hscale: number): number {
  const stepPx = CELL_WIDTH * hscale * lanePeriod(signal);
  if (stepPx <= 0) return 1;
  const minShapePx = BUS_DIAGONAL * hscale * 3;
  return Math.max(1, Math.ceil(minShapePx / stepPx));
}

export function minStepsForBusLabel(
  label: string,
  signal: Signal,
  hscale: number,
  rowHeight = ROW_HEIGHT,
): number {
  const textWidth = measureBusLabelWidth(label, busLabelFontPx(rowHeight));
  const diagonal = BUS_DIAGONAL * hscale;
  const neededPx = textWidth + 2 * diagonal + LABEL_PADDING;
  const stepPx = CELL_WIDTH * hscale * lanePeriod(signal);
  if (stepPx <= 0) return 1;
  const forText = Math.max(1, Math.ceil(neededPx / stepPx));
  return Math.max(forText, minStepsForBusShape(signal, hscale));
}

export interface SegmentLabelFit {
  fits: boolean;
  textWidth: number;
  usablePx: number;
  spanSteps: number;
  minSteps: number;
  minHscale: number;
  extraSteps: number;
  tooNarrowForShape: boolean;
}

function segmentLabelFitsAt(
  segment: VectorSegment,
  signal: Signal,
  hscale: number,
  rowHeight: number,
  label: string,
): Omit<SegmentLabelFit, 'minHscale'> {
  const spanSteps = segment.endStep - segment.startStep;
  const spanPx = segmentSpanPx(segment, signal, hscale);
  const usablePx = segmentUsableLabelPx(spanPx, hscale);
  const fontPx = busLabelFontPx(rowHeight);
  const slack = labelOverflowSlackPx(fontPx);
  const textWidth = measureBusLabelWidth(label, fontPx);
  const minSteps = minStepsForBusLabel(label, signal, hscale, rowHeight);
  const tooNarrowForShape = spanSteps < minStepsForBusShape(signal, hscale);
  return {
    fits: !tooNarrowForShape && textWidth <= usablePx + slack,
    textWidth,
    usablePx,
    spanSteps,
    minSteps,
    extraSteps: Math.max(0, minSteps - spanSteps),
    tooNarrowForShape,
  };
}

export function minHscaleForSegmentLabel(
  segment: VectorSegment,
  signal: Signal,
  rowHeight = ROW_HEIGHT,
  label = segment.value,
): number {
  const trimmed = label.trim();
  if (!trimmed) return MIN_HSCALE;
  if (segmentLabelFitsAt(segment, signal, MIN_HSCALE, rowHeight, label).fits) {
    return MIN_HSCALE;
  }
  for (let h = MIN_HSCALE + HSCALE_STEP; h <= MAX_HSCALE + 1e-9; h += HSCALE_STEP) {
    const next = clampHscale(h);
    if (segmentLabelFitsAt(segment, signal, next, rowHeight, label).fits) {
      return next;
    }
  }
  return MAX_HSCALE;
}

export function segmentLabelFit(
  segment: VectorSegment,
  signal: Signal,
  hscale: number,
  rowHeight = ROW_HEIGHT,
  label = segment.value,
): SegmentLabelFit {
  const fitAt = segmentLabelFitsAt(segment, signal, hscale, rowHeight, label);
  return {
    ...fitAt,
    minHscale: minHscaleForSegmentLabel(segment, signal, rowHeight, label),
  };
}

/** True when a label cannot render at full size in the given pixel budget (canvas or logical). */
export function labelOverflowsInWidth(
  label: string,
  maxWidthPx: number,
  fontPx: number,
  spanTooNarrow: boolean,
): boolean {
  const trimmed = label.trim();
  if (!trimmed) return false;
  if (spanTooNarrow) return true;
  if (maxWidthPx <= 4) return true;
  const slack = labelOverflowSlackPx(fontPx);
  return trimmed
    .split('\n')
    .some((line) => line.length > 0 && measureBusLabelWidth(line, fontPx) > maxWidthPx + slack);
}

export function segmentLabelOverflows(
  segment: VectorSegment,
  signal: Signal,
  hscale: number,
  rowHeight = ROW_HEIGHT,
  label = segment.value,
): boolean {
  return !segmentLabelFit(segment, signal, hscale, rowHeight, label).fits;
}
