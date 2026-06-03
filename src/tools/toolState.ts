import { useStore } from '../shared/store';
import type { HitTestResult } from '../renderer/hitTest';

/** Ephemeral pointer-drag and selection state shared across tool modules */

export interface SelectOverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface StepSelection {
  start: number;
  end: number;
}

let paintDragging = false;
let eraseDragging = false;
let selectDragging = false;
let selectAnchor: { x: number; y: number } | null = null;
let selectOverlay: SelectOverlayRect | null = null;
let stepSelection: StepSelection | null = null;
let capturedPointerId: number | null = null;
let selectClickHit: HitTestResult | null = null;

export const SELECT_DRAG_THRESHOLD_PX = 5;

export const toolState = {
  isPaintDragging(): boolean {
    return paintDragging;
  },
  isEraseDragging(): boolean {
    return eraseDragging;
  },
  isSelectDragging(): boolean {
    return selectDragging;
  },

  beginPaintDrag(pointerId: number): void {
    paintDragging = true;
    capturedPointerId = pointerId;
  },
  endPaintDrag(): void {
    paintDragging = false;
    capturedPointerId = null;
  },

  beginEraseDrag(pointerId: number): void {
    eraseDragging = true;
    capturedPointerId = pointerId;
  },
  endEraseDrag(): void {
    eraseDragging = false;
    capturedPointerId = null;
  },

  beginSelectDrag(x: number, y: number, pointerId: number): void {
    selectDragging = true;
    selectAnchor = { x, y };
    selectOverlay = { left: x, top: y, width: 0, height: 0 };
    capturedPointerId = pointerId;
  },
  updateSelectDrag(x: number, y: number): void {
    if (!selectAnchor) return;
    const left = Math.min(selectAnchor.x, x);
    const top = Math.min(selectAnchor.y, y);
    selectOverlay = {
      left,
      top,
      width: Math.abs(x - selectAnchor.x),
      height: Math.abs(y - selectAnchor.y),
    };
  },
  endSelectDrag(): void {
    selectDragging = false;
    selectAnchor = null;
    capturedPointerId = null;
  },

  getSelectOverlay(): SelectOverlayRect | null {
    return selectOverlay;
  },
  clearSelectOverlay(): void {
    selectOverlay = null;
  },

  setStepSelection(sel: StepSelection | null): void {
    stepSelection = sel;
  },
  getStepSelection(): StepSelection | null {
    return stepSelection;
  },

  getCapturedPointerId(): number | null {
    return capturedPointerId;
  },

  setSelectClickHit(hit: HitTestResult | null): void {
    selectClickHit = hit;
  },
  getSelectClickHit(): HitTestResult | null {
    return selectClickHit;
  },

  cancelAll(): void {
    paintDragging = false;
    eraseDragging = false;
    selectDragging = false;
    selectAnchor = null;
    selectOverlay = null;
    stepSelection = null;
    capturedPointerId = null;
    selectClickHit = null;
  },
};

export function setActiveSignalIds(ids: string[]): void {
  useStore.setState((s) => {
    s.view.activeSignalIds = ids;
  });
}
