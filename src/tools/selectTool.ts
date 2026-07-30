import type { DiagramState, SignalOrGroup, ViewState } from '../shared/types';
import {
  CELL_WIDTH,
  ROW_HEIGHT,
  TIME_AXIS_HEIGHT,
} from '../shared/constants';
import { findSignal, useStore } from '../shared/store';
import { buildRowLayout } from '../renderer/rowLayout';
import {
  canvasToLogicalX,
  canvasToLogicalY,
  logicalToCanvasX,
  logicalToCanvasY,
  type ViewTransform,
} from '../renderer/coordinates';
import { pickBusLabelFromHit } from './busLabelPick';
import { flushPendingCodeToDiagram } from './codeFlush';
import { setActiveSignalIds, toolState, SELECT_DRAG_THRESHOLD_PX } from './toolState';
import type { HitTestResult } from '../renderer/hitTest';
import { measureHeadFoot } from '../renderer/renderHeadFoot';
import {
  annotationXCells,
  annotationYLogical,
  layoutArrowAnnotations,
} from '../renderer/annotationLayout';

interface AnnotationDrag {
  id: string;
  arrowEndpoint?: 'from' | 'to';
  historyRecorded: boolean;
}

let annotationDrag: AnnotationDrag | null = null;

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
  useStore.getState().setActiveTimingCellIndex(null);
  toolState.setStepSelection(
    ids.length > 0 ? { start: stepStart, end: stepEnd } : null,
  );
}

function applyClickSelection(hit: HitTestResult, diagram: DiagramState): void {
  if (hit.annotationId) {
    useStore.getState().setActiveAnnotationId(hit.annotationId);
    useStore.getState().setActiveTimingCellIndex(null);
    toolState.setStepSelection(null);
    return;
  }
  if (hit.signalId && hit.signalType !== 'group' && hit.signalType !== null) {
    setActiveSignalIds([hit.signalId]);
    let hasFineTiming = false;
    findSignal(diagram.signals, hit.signalId, (signal) => {
      hasFineTiming = Boolean(signal.digitalTiming);
    });
    useStore.getState().setActiveTimingCellIndex(
      hasFineTiming && hit.step !== null ? hit.step : null,
    );
    if (hit.step !== null) {
      toolState.setStepSelection({ start: hit.step, end: hit.step });
    } else {
      toolState.setStepSelection({
        start: 0,
        end: diagram.config.totalSteps - 1,
      });
    }
    pickBusLabelFromHit(hit, diagram);
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
  if (hit.annotationId) {
    const state = useStore.getState();
    state.setActiveAnnotationId(hit.annotationId);
    const annotation = state.diagram.annotations?.find(
      (candidate) => candidate.id === hit.annotationId,
    );
    let arrowEndpoint: 'from' | 'to' | undefined;
    if (annotation?.type === 'arrow') {
      const transform = viewTransform(state.diagram, state.view);
      const rows = buildRowLayout(state.diagram.signals);
      const layout = layoutArrowAnnotations(state.diagram, rows).find(
        (candidate) => candidate.annotation.id === annotation.id,
      );
      if (layout) {
        const { headHeight } = measureHeadFoot(state.diagram.config);
        const waveformTop = TIME_AXIS_HEIGHT + headHeight;
        const endpoints = [
          ['from', layout.from],
          ['to', layout.to],
        ] as const;
        arrowEndpoint = endpoints.find(([, point]) =>
          Math.hypot(
            e.offsetX - logicalToCanvasX(point.x, transform),
            e.offsetY - waveformTop - logicalToCanvasY(point.y, transform),
          ) <= 10,
        )?.[0];
      }
    }
    annotationDrag = {
      id: hit.annotationId,
      arrowEndpoint,
      historyRecorded: false,
    };
    if (canvas) canvas.setPointerCapture(e.pointerId);
    return;
  }
  toolState.setSelectClickHit(hit);
  const x = e.offsetX;
  const y = e.offsetY;
  toolState.beginSelectDrag(x, y, e.pointerId);
  if (canvas) canvas.setPointerCapture(e.pointerId);
}

export function selectPointerMove(e: PointerEvent): void {
  if (annotationDrag) {
    const state = useStore.getState();
    const annotation = state.diagram.annotations?.find(
      (candidate) => candidate.id === annotationDrag?.id,
    );
    if (!annotation) return;
    const transform = viewTransform(state.diagram, state.view);
    const rawX = canvasToLogicalX(e.offsetX, transform) / CELL_WIDTH;
    const { headHeight } = measureHeadFoot(state.diagram.config);
    const rawY = canvasToLogicalY(
      e.offsetY - TIME_AXIS_HEIGHT - headHeight,
      transform,
    ) / ROW_HEIGHT;
    if (annotation.type === 'arrow') {
      if (!annotationDrag.arrowEndpoint) return;
      const options = { recordHistory: !annotationDrag.historyRecorded };
      state.updateArrowAnnotation(annotation.id, {
        [annotationDrag.arrowEndpoint]: {
          kind: 'point',
          x: Math.round(Math.max(0, rawX) * 100) / 100,
          y: Math.round(Math.max(0, rawY) * 100) / 100,
        },
      }, options);
      annotationDrag.historyRecorded = true;
      return;
    }
    const snapToGrid =
      annotation.type !== 'horizontal-line'
      && annotation.snapToGrid !== false;
    const x = snapToGrid && !e.shiftKey
      ? Math.round(rawX - 0.5) + 0.5
      : Math.round(rawX * 100) / 100;
    const y = Math.round(rawY * 100) / 100;
    const options = { recordHistory: !annotationDrag.historyRecorded };
    if (annotation.type === 'text') {
      state.updateTextAnnotation(annotation.id, {
        x,
        y,
        coordinateMode: 'diagram',
      }, options);
    } else if (annotation.type === 'vertical-line') {
      state.updateVerticalLineAnnotation(annotation.id, { x }, options);
    } else if (annotation.type === 'horizontal-line') {
      state.updateHorizontalLineAnnotation(annotation.id, {
        y,
        coordinateMode: 'diagram',
      }, options);
    } else {
      state.updateGlobalCompressionAnnotation(annotation.id, { x }, options);
    }
    annotationDrag.historyRecorded = true;
    return;
  }
  if (!toolState.isSelectDragging()) return;
  toolState.updateSelectDrag(e.offsetX, e.offsetY);
}

export function selectPointerUp(
  e: PointerEvent,
  canvas: HTMLCanvasElement | null,
): void {
  if (annotationDrag) {
    releasePointer(canvas, e);
    annotationDrag = null;
    return;
  }
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
  if (annotationDrag) {
    annotationDrag = null;
  }
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
  useStore.getState().setActiveTimingCellIndex(null);
  toolState.setStepSelection({
    start: 0,
    end: diagram.config.totalSteps - 1,
  });
}

export function nudgeSelectedAnnotation(
  key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown',
  fine: boolean,
): boolean {
  const state = useStore.getState();
  const annotation = state.diagram.annotations?.find(
    (candidate) => candidate.id === state.view.activeAnnotationId,
  );
  if (!annotation || annotation.type === 'arrow') return false;
  const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
  const direction = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;

  if (horizontal) {
    if (annotation.type === 'horizontal-line') return false;
    const snapToGrid = annotation.snapToGrid !== false;
    const delta = fine ? 0.01 : snapToGrid ? 1 : 0.1;
    const x = annotationXCells(annotation) + direction * delta;
    if (annotation.type === 'text') {
      state.updateTextAnnotation(annotation.id, { x });
    } else if (annotation.type === 'vertical-line') {
      state.updateVerticalLineAnnotation(annotation.id, { x });
    } else {
      state.updateGlobalCompressionAnnotation(annotation.id, { x });
    }
    return true;
  }

  if (annotation.type === 'vertical-line' || annotation.type === 'global-compression') {
    return false;
  }
  const rows = buildRowLayout(state.diagram.signals);
  const currentY = (annotationYLogical(annotation, rows) ?? 0) / ROW_HEIGHT;
  state[annotation.type === 'text'
    ? 'updateTextAnnotation'
    : 'updateHorizontalLineAnnotation'](
    annotation.id,
    {
      y: currentY + direction * (fine ? 0.01 : 0.1),
      coordinateMode: 'diagram',
    },
  );
  return true;
}

export function deleteSelection(): void {
  const { view, diagram } = useStore.getState();
  const steps = toolState.getStepSelection();
  const { eraseSignalStateRange, removeSignal } = useStore.getState();

  if (view.activeAnnotationId) {
    useStore.getState().removeAnnotation(view.activeAnnotationId);
    useStore.getState().setActiveAnnotationId(null);
    return;
  }

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
  useStore.getState().setActiveTimingCellIndex(null);
  useStore.getState().setActiveAnnotationId(null);
  toolState.setStepSelection(null);
  toolState.clearSelectOverlay();
}
