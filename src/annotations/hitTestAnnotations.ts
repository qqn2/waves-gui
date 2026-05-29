import type { DiagramState } from '../shared/types';
import {
  canvasToLogicalX,
  canvasToLogicalY,
  type ViewTransform,
} from '../renderer/coordinates';
import { diagramContentHeight, getSignalRowY, stepCenterX, stepLeftX } from './annotationGeometry';

const ARROW_HIT_PX = 6;
const HANDLE_HIT_LOGICAL = 8;

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Returns annotation id under canvas point, or null (topmost wins). */
export function hitTestAnnotations(
  canvasX: number,
  canvasY: number,
  diagram: DiagramState,
  transform: ViewTransform,
  axisOffset: number,
): string | null {
  const lx = canvasToLogicalX(canvasX, transform);
  const ly = canvasToLogicalY(canvasY - axisOffset, transform);
  const contentH = diagramContentHeight(diagram.signals);
  const zoom = transform.zoom;

  for (let i = diagram.annotations.length - 1; i >= 0; i--) {
    const ann = diagram.annotations[i]!;
    switch (ann.type) {
      case 'arrow': {
        const fromX = stepCenterX(ann.fromStep);
        const fromY = getSignalRowY(ann.fromSignalId, diagram.signals);
        const toX = stepCenterX(ann.toStep);
        const toY = getSignalRowY(ann.toSignalId, diagram.signals);
        if (
          distToSegment(lx, ly, fromX, fromY, toX, toY) <=
          ARROW_HIT_PX / zoom
        ) {
          return ann.id;
        }
        break;
      }
      case 'marker': {
        const x = stepLeftX(ann.step);
        if (Math.abs(lx - x) <= HANDLE_HIT_LOGICAL && ly >= 0 && ly <= contentH) {
          return ann.id;
        }
        break;
      }
      case 'timespan': {
        const x1 = stepLeftX(ann.startStep);
        const x2 = stepLeftX(ann.endStep + 1);
        const y = ann.row === 'bottom' ? contentH + 16 : -16;
        if (ly >= y - HANDLE_HIT_LOGICAL && ly <= y + HANDLE_HIT_LOGICAL) {
          if (lx >= x1 - HANDLE_HIT_LOGICAL && lx <= x2 + HANDLE_HIT_LOGICAL) {
            return ann.id;
          }
        }
        break;
      }
      case 'text': {
        const x = stepCenterX(ann.step);
        const y = getSignalRowY(ann.signalId, diagram.signals);
        if (Math.hypot(lx - x, ly - y) <= HANDLE_HIT_LOGICAL * 2) return ann.id;
        break;
      }
    }
  }
  return null;
}
