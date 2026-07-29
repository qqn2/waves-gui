import type { HitTestResult } from '../renderer/hitTest';
import { useStore } from '../shared/store';
import {
  CELL_WIDTH,
  ROW_HEIGHT,
  TIME_AXIS_HEIGHT,
} from '../shared/constants';
import { canvasToLogicalX, canvasToLogicalY } from '../renderer/coordinates';
import { measureHeadFoot } from '../renderer/renderHeadFoot';

function pointerAnchor(event: PointerEvent): { x: number; y: number } {
  const { diagram, view } = useStore.getState();
  const transform = {
    zoom: view.zoom,
    hscale: diagram.config.hscale,
    scrollX: view.scrollX,
    scrollY: view.scrollY,
  };
  const { headHeight } = measureHeadFoot(diagram.config);
  return {
    x: Math.max(
      0,
      Math.min(
        diagram.config.totalSteps,
        canvasToLogicalX(event.offsetX, transform) / CELL_WIDTH,
      ),
    ),
    y: Math.max(
      0,
      canvasToLogicalY(
        event.offsetY - TIME_AXIS_HEIGHT - headHeight,
        transform,
      ) / ROW_HEIGHT,
    ),
  };
}

function creationAnchor(event: PointerEvent): { x: number; y: number } {
  const anchor = pointerAnchor(event);
  const totalSteps = useStore.getState().diagram.config.totalSteps;
  return useStore.getState().view.annotationSnapToGrid !== false
    ? {
        x: Math.min(Math.max(0.5, totalSteps - 0.5), Math.floor(anchor.x) + 0.5),
        y: Math.floor(anchor.y) + 0.5,
      }
    : anchor;
}

export function cancelStructuredArrow(): void {
  const state = useStore.getState();
  state.setStructuredArrowPending(null);
  state.setEdgeToolHover(null);
}

export function structuredArrowPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  const anchor = creationAnchor(event);
  const state = useStore.getState();
  const pendingArrowStart = state.view.structuredArrowPending;
  if (!pendingArrowStart) {
    state.setStructuredArrowPending(anchor);
    return;
  }
  const { addArrowAnnotation, setActiveAnnotationId, setTool } = state;
  const id = addArrowAnnotation({
    shape: '->',
    from: { kind: 'point', ...pendingArrowStart },
    to: { kind: 'point', ...anchor },
  });
  state.setStructuredArrowPending(null);
  state.setEdgeToolHover(null);
  if (id) {
    setActiveAnnotationId(id);
    setTool('cursor');
  }
}

export function annotationPointerDown(
  event: PointerEvent,
  hit: HitTestResult,
): void {
  if (event.button !== 0 || hit.step === null || !hit.signalId) return;
  if (hit.signalType !== 'bit' && hit.signalType !== 'vector') return;
  const {
    addTextAnnotation,
    setActiveAnnotationId,
    view,
  } = useStore.getState();
  const anchor = pointerAnchor(event);
  const snapToGrid = view.annotationSnapToGrid !== false;
  const id = addTextAnnotation({
    text: 'Annotation',
    tick: hit.step,
    signalId: hit.signalId,
    snapToGrid,
    ...(!snapToGrid ? { x: anchor.x } : {}),
  });
  if (id) setActiveAnnotationId(id);
}

export function verticalLinePointerDown(
  event: PointerEvent,
  hit: HitTestResult,
): void {
  if (event.button !== 0 || hit.step === null) return;
  const state = useStore.getState();
  const anchor = pointerAnchor(event);
  const snapToGrid = state.view.annotationSnapToGrid !== false;
  const id = state.addVerticalLineAnnotation({
    tick: hit.step,
    snapToGrid,
    ...(!snapToGrid ? { x: anchor.x } : {}),
  });
  if (id) state.setActiveAnnotationId(id);
}

export function horizontalLinePointerDown(
  event: PointerEvent,
  hit: HitTestResult,
): void {
  if (event.button !== 0 || !hit.signalId || hit.signalType === 'group') return;
  const { addHorizontalLineAnnotation, setActiveAnnotationId } = useStore.getState();
  const id = addHorizontalLineAnnotation({
    signalId: hit.signalId,
    yOffset: 0,
  });
  if (id) setActiveAnnotationId(id);
}

export function globalCompressionPointerDown(
  event: PointerEvent,
  hit: HitTestResult,
): void {
  if (event.button !== 0 || hit.step === null) return;
  const state = useStore.getState();
  const anchor = pointerAnchor(event);
  const snapToGrid = state.view.annotationSnapToGrid !== false;
  const id = state.addGlobalCompressionAnnotation({
    tick: hit.step,
    snapToGrid,
    ...(!snapToGrid ? { x: anchor.x } : {}),
  });
  if (id) state.setActiveAnnotationId(id);
}
