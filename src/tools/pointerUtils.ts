import type { DiagramState, Signal, ViewState } from '../shared/types';
import { findSignal } from '../shared/store';
import { canvasToLogicalX, type ViewTransform } from '../renderer/coordinates';
import { stepAtLogicalXForSignal } from '../renderer/laneTiming';
import { stepFromLogicalX } from '../renderer/laneTiming';

export function viewTransform(
  diagram: DiagramState,
  view: ViewState,
): ViewTransform {
  return {
    zoom: view.zoom,
    hscale: diagram.config.hscale,
    scrollX: view.scrollX,
    scrollY: view.scrollY,
  };
}

export function clampStep(step: number, totalSteps: number): number {
  return Math.max(0, Math.min(totalSteps - 1, step));
}

function signalById(
  diagram: DiagramState,
  signalId: string | undefined,
): Signal | null {
  if (!signalId) return null;
  let found: Signal | null = null;
  findSignal(diagram.signals, signalId, (s) => {
    found = s;
  });
  return found;
}

/** Time-step column under a canvas X coordinate (lane period/phase when signal known). */
export function stepAtCanvasX(
  canvasX: number,
  diagram: DiagramState,
  view: ViewState,
  signalId?: string,
): number {
  const t = viewTransform(diagram, view);
  const logicalX = canvasToLogicalX(canvasX, t);
  const totalSteps = diagram.config.totalSteps;
  const signal = signalById(diagram, signalId);
  if (signal) {
    const step = stepAtLogicalXForSignal(logicalX, signal, totalSteps);
    if (step !== null) return step;
  }
  return clampStep(stepFromLogicalX(logicalX, null), totalSteps);
}
