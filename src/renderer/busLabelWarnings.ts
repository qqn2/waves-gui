import { BUS_DIAGONAL, HSCALE_STEP, MAX_HSCALE, ROW_HEIGHT } from '../shared/constants';
import type { Signal, SignalOrGroup, VectorSegment } from '../shared/types';
import { labelOverflowsInWidth } from '../shared/vectorLabelFit';
import { stepLogicalX, stepLogicalXEnd } from './laneTiming';

/** Matches renderVectorSignal at 100% canvas zoom, including native lane timing. */
function fitAt(segment: VectorSegment, signal: Signal, hscale: number, label: string) {
  const span = (stepLogicalXEnd(signal, segment.endStep - 1)
    - stepLogicalX(signal, segment.startStep)) * hscale;
  const diagonal = BUS_DIAGONAL * hscale;
  const fontPx = signal.style?.fontSize ?? Math.max(10, (signal.rowHeight ?? ROW_HEIGHT) * 0.35);
  const tooNarrowForShape = span < diagonal * 3;
  return {
    fits: !labelOverflowsInWidth(label, span - diagonal * 2 - 8, fontPx, tooNarrowForShape),
    tooNarrowForShape,
  };
}

export function busSegmentLabelFit(
  segment: VectorSegment,
  signal: Signal,
  hscale: number,
  label = segment.value,
): { fits: boolean; tooNarrowForShape: boolean; minHscale: number | null } {
  const current = fitAt(segment, signal, hscale, label);
  if (current.fits) return { ...current, minHscale: hscale };
  for (let step = Math.floor(hscale / HSCALE_STEP) + 1; step <= MAX_HSCALE / HSCALE_STEP; step++) {
    const candidate = Number((step * HSCALE_STEP).toFixed(1));
    if (fitAt(segment, signal, candidate, label).fits) return { ...current, minHscale: candidate };
  }
  return { ...current, minHscale: null };
}

export interface BusLabelOverflow {
  signalId: string;
  segmentId: string;
  minHscale: number | null;
}

export function busLabelWarnings(signals: SignalOrGroup[], hscale: number): BusLabelOverflow[] {
  const warnings: BusLabelOverflow[] = [];
  const walk = (items: SignalOrGroup[]) => {
    for (const signal of items) {
      if (signal.type === 'group') {
        walk(signal.children);
      } else if (signal.type === 'vector') {
        for (const segment of signal.segments) {
          const fit = busSegmentLabelFit(segment, signal, hscale);
          if (!fit.fits) warnings.push({ signalId: signal.id, segmentId: segment.id, minHscale: fit.minHscale });
        }
      }
    }
  };
  walk(signals);
  return warnings;
}
