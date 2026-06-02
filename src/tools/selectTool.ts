import type { DiagramState, SignalOrGroup, ViewState } from '../shared/types';
import { CELL_WIDTH } from '../shared/constants';
import { useStore } from '../shared/store';
import { buildRowLayout } from '../renderer/rowLayout';
import {
  canvasToLogicalX,
  canvasToLogicalY,
  type ViewTransform,
} from '../renderer/coordinates';
import { flushPendingCodeToDiagram } from './codeFlush';
import { setActiveSignalIds, toolState, SELECT_DRAG_THRESHOLD_PX } from './toolState';
import type { HitTestResult } from './hitTestStub';

function viewTransform(diagram: DiagramState, view: ViewState): ViewTransform {
  return {
    zoom: view.zoom,
    hscale: diagram.config.hscale,
    scrollX: view.scrollX,
    scrollY: view.scrollY,
  };
}

function collectSignalIds(signals: SignalOrGroup[]): string[] {
  const ids: string[] = [];
  for (const sg of signals) {
    if (sg.type === 'group') {
      ids.push(...collectSignalIds(sg.children));
    } else if (sg.type !== 'spacer') {
      ids.push(sg.id);
    }
  }
  return ids;
}

function releasePointer(canvas: HTMLCanvasElement | null, e: PointerEvent): void {
  if (!canvas) return;
  if (canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
}

function applyRectSelection(
  diagram: DiagramState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  const view = useStore.getState().view;
  const t = viewTransform(diagram, view);
  const logicalX0 = canvasToLogicalX(Math.min(x0, x1), t);
  const logicalX1 = canvasToLogicalX(Math.max(x0, x1), t);
  const logicalY0 = canvasToLogicalY(Math.min(y0, y1), t);
  const logicalY1 = canvasToLogicalY(Math.max(y0, y1), t);

  const stepStart = Math.max(0, Math.floor(logicalX0 / CELL_WIDTH));
  const stepEnd = Math.min(
    diagram.config.totalSteps - 1,
    Math.floor(logicalX1 / CELL_WIDTH),
  );

  const rows = buildRowLayout(diagram.signals);
  const ids: string[] = [];
  for (const row of rows) {
    if (row.type === 'group' || row.type === 'spacer') continue;
    const rowBottom = row.y + row.height;
    if (logicalY1 >= row.y && logicalY0 < rowBottom) {
      ids.push(row.id);
    }
  }

  setActiveSignalIds(ids);
  toolState.setStepSelection(
    ids.length > 0 ? { start: stepStart, end: stepEnd } : null,
  );
}

function applyClickSelection(hit: HitTestResult, diagram: DiagramState): void {
  if (hit.signalId && hit.signalType !== 'group' && hit.signalType !== null) {
    setActiveSignalIds([hit.signalId]);
    if (hit.step !== null) {
      toolState.setStepSelection({ start: hit.step, end: hit.step });
    } else {
      toolState.setStepSelection({
        start: 0,
        end: diagram.config.totalSteps - 1,
      });
    }
    return;
  }
  clearSelection();
}

export function selectPointerDown(
  e: PointerEvent,
  canvas: HTMLCanvasElement | null,
  hit: HitTestResult,
): void {
  flushPendingCodeToDiagram();
  toolState.setSelectClickHit(hit);
  const x = e.offsetX;
  const y = e.offsetY;
  toolState.beginSelectDrag(x, y, e.pointerId);
  if (canvas) canvas.setPointerCapture(e.pointerId);
}

export function selectPointerMove(e: PointerEvent): void {
  if (!toolState.isSelectDragging()) return;
  toolState.updateSelectDrag(e.offsetX, e.offsetY);
}

export function selectPointerUp(
  e: PointerEvent,
  canvas: HTMLCanvasElement | null,
): void {
  if (!toolState.isSelectDragging()) return;
  releasePointer(canvas, e);
  toolState.endSelectDrag();

  const overlay = toolState.getSelectOverlay();
  const clickHit = toolState.getSelectClickHit();
  toolState.setSelectClickHit(null);
  const diagram = useStore.getState().diagram;

  const isDrag =
    overlay &&
    (overlay.width > SELECT_DRAG_THRESHOLD_PX ||
      overlay.height > SELECT_DRAG_THRESHOLD_PX);

  if (isDrag && overlay) {
    applyRectSelection(
      diagram,
      overlay.left,
      overlay.top,
      overlay.left + overlay.width,
      overlay.top + overlay.height,
    );
  } else if (clickHit) {
    applyClickSelection(clickHit, diagram);
  }

  toolState.clearSelectOverlay();
}

export function selectCancel(canvas: HTMLCanvasElement | null): void {
  if (!toolState.isSelectDragging()) return;
  const pid = toolState.getCapturedPointerId();
  if (canvas && pid !== null && canvas.hasPointerCapture(pid)) {
    canvas.releasePointerCapture(pid);
  }
  toolState.endSelectDrag();
  toolState.setSelectClickHit(null);
  toolState.clearSelectOverlay();
}

export function selectAllSignals(): void {
  const diagram = useStore.getState().diagram;
  const ids = collectSignalIds(diagram.signals);
  setActiveSignalIds(ids);
  toolState.setStepSelection({
    start: 0,
    end: diagram.config.totalSteps - 1,
  });
}

export function deleteSelection(): void {
  const { view, diagram } = useStore.getState();
  const steps = toolState.getStepSelection();
  const { eraseSignalStateRange, removeSignal } = useStore.getState();

  if (steps && view.activeSignalIds.length > 0) {
    const lo = Math.min(steps.start, steps.end);
    const hi = Math.max(steps.start, steps.end);
    for (const signalId of view.activeSignalIds) {
      eraseSignalStateRange(signalId, lo, hi);
    }
    return;
  }

  if (view.activeSignalIds.length > 0) {
    const ids = [...view.activeSignalIds];
    const msg =
      ids.length === 1
        ? 'Remove selected signal?'
        : `Remove ${ids.length} selected signals?`;
    if (!window.confirm(msg)) return;
    for (const signalId of ids) {
      removeSignal(signalId);
    }
    clearSelection();
    return;
  }

  if (steps) {
    const lo = Math.min(steps.start, steps.end);
    const hi = Math.max(steps.start, steps.end);
    const allIds = collectSignalIds(diagram.signals);
    for (const signalId of allIds) {
      eraseSignalStateRange(signalId, lo, hi);
    }
  }
}

export function clearSelection(): void {
  setActiveSignalIds([]);
  toolState.setStepSelection(null);
  toolState.clearSelectOverlay();
}
