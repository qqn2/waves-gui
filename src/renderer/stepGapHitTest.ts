import type { DiagramState, Signal, SignalOrGroup, ViewState } from '../shared/types';
import { TIME_AXIS_HEIGHT } from '../shared/constants';
import { buildRowLayout } from './rowLayout';
import { measureHeadFoot } from './renderHeadFoot';
import { canvasToLogicalX, canvasToLogicalY, type ViewTransform } from './coordinates';
import { stepLogicalXEnd } from './laneTiming';
import { GLITCH_HIT_PX } from './glitchHitTest';

function buildSignalById(signals: SignalOrGroup[]): Map<string, Signal> {
  const map = new Map<string, Signal>();
  const walk = (list: SignalOrGroup[]) => {
    for (const item of list) {
      if (item.type === 'group') walk(item.children);
      else map.set(item.id, item);
    }
  };
  walk(signals);
  return map;
}

/** Timeline gap (`|`) boundary under the pointer (between steps `b` and `b + 1`). */
export function hitTestStepGapBoundary(
  canvasX: number,
  canvasY: number,
  diagram: DiagramState,
  view: ViewState,
): { signalId: string; boundaryIndex: number } | null {
  const transform: ViewTransform = {
    zoom: view.zoom,
    hscale: diagram.config.hscale,
    scrollX: view.scrollX,
    scrollY: view.scrollY,
  };
  const axisOffset = view.showTimeAxis ? TIME_AXIS_HEIGHT : 0;
  const { headHeight } = measureHeadFoot(diagram.config);
  const waveformTop = axisOffset + headHeight;
  const logicalX = canvasToLogicalX(canvasX, transform);
  const logicalY = canvasToLogicalY(canvasY - waveformTop, transform);
  const hitLogical = GLITCH_HIT_PX / (transform.zoom * transform.hscale);

  const rows = buildRowLayout(diagram.signals);
  const signalById = buildSignalById(diagram.signals);

  for (const row of rows) {
    if (row.type === 'group' || row.type === 'spacer') continue;
    if (logicalY < row.y || logicalY >= row.y + row.height) continue;

    const signal = signalById.get(row.id);
    if (!signal || signal.type === 'spacer') continue;
    const gaps = signal.stepGaps;
    if (!gaps?.some(Boolean)) continue;

    for (let b = 0; b < gaps.length; b++) {
      if (!gaps[b]) continue;
      const xEdge = stepLogicalXEnd(signal, b);
      if (Math.abs(logicalX - xEdge) <= hitLogical) {
        return { signalId: signal.id, boundaryIndex: b };
      }
    }
  }

  return null;
}
