import { CELL_WIDTH } from '../shared/constants';

/** Scroll/zoom/hscale used to map logical layout ↔ canvas CSS pixels. */
export interface ViewTransform {
  zoom: number;
  hscale: number;
  scrollX: number;
  scrollY: number;
}

export function canvasCellWidth(hscale: number, zoom: number): number {
  return CELL_WIDTH * hscale * zoom;
}

export function logicalToCanvasX(logicalX: number, t: ViewTransform): number {
  return logicalX * t.zoom * t.hscale - t.scrollX;
}

export function logicalToCanvasY(logicalY: number, t: ViewTransform): number {
  return logicalY * t.zoom - t.scrollY;
}

export function canvasToLogicalX(canvasX: number, t: ViewTransform): number {
  return (canvasX + t.scrollX) / (t.zoom * t.hscale);
}

export function canvasToLogicalY(canvasY: number, t: ViewTransform): number {
  return (canvasY + t.scrollY) / t.zoom;
}

export function stepFromCanvasX(canvasX: number, t: ViewTransform): number {
  return Math.floor(canvasToLogicalX(canvasX, t) / CELL_WIDTH);
}
