import type { DiagramState, ViewState } from '../shared/types';
import { CELL_WIDTH } from '../shared/constants';
import { canvasToLogicalX, type ViewTransform } from '../renderer/coordinates';

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

/** Time-step column under a canvas X coordinate (matches waveform hit-test). */
export function stepAtCanvasX(
  canvasX: number,
  diagram: DiagramState,
  view: ViewState,
): number {
  const t = viewTransform(diagram, view);
  const logicalX = canvasToLogicalX(canvasX, t);
  return clampStep(Math.floor(logicalX / CELL_WIDTH), diagram.config.totalSteps);
}
