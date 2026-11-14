import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../shared/store';
import type { DiagramState } from '../shared/types';
import {
  buildNodeIndex,
  edgeCurveMidpoint,
  defaultCurveControl,
  isCurvyEdgeShape,
  parseEdge,
  resolveEdgeAnchors,
} from '../renderer/edgeLayout';

const HANDLE_HIT_PX = 10;
type CurveControl = { c1x: number; c2x: number };

export function hitTestEdgeCurveHandle(
  canvasX: number,
  canvasY: number,
): number | null {
  const { diagram, view } = useStore.getState();
  const edges = diagram.edges ?? [];
  const controls = diagram.edgeCurveControls ?? {};
  const nodeIndex = buildNodeIndex(
    diagram.signals,
    diagram.compatibility?.extensionsEnabled === true,
  );

  for (let i = edges.length - 1; i >= 0; i--) {
    const parsed = parseEdge(edges[i]!);
    if (!parsed || !isCurvyEdgeShape(parsed.shape)) continue;
    const anchors = resolveEdgeAnchors(diagram, view, parsed, nodeIndex);
    if (!anchors) continue;
    const curve = controls[i] ?? defaultCurveControl(parsed.shape);
    const mid = edgeCurveMidpoint(anchors.from, anchors.to, parsed.shape, curve);
    if (Math.hypot(canvasX - mid.x, canvasY - mid.y) <= HANDLE_HIT_PX) return i;
  }
  return null;
}

interface CurveDrag {
  pointerId: number;
  index: number;
  edge: string;
  expectedDiagram: DiagramState;
  startX: number;
  dx: number;
  shape: string;
  startControl: CurveControl;
  currentControl: CurveControl;
  changed: boolean;
}

/** Move the visible midpoint from its initial position, without a first-move jump. */
function controlFromDelta(drag: CurveDrag, pointerX: number): CurveControl {
  if (Math.abs(drag.dx) < 1 || pointerX === drag.startX) return drag.startControl;
  const { c1x, c2x } = drag.startControl;
  const rounded = (value: number) => Math.round(value * 1e6) / 1e6;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  // At t=0.5 each control point contributes 3/8 of its x coordinate.
  // A half-curve fixes one endpoint tangent; a full curve moves both controls.
  const delta = (pointerX - drag.startX) / drag.dx;
  if (drag.shape === '-~') return { c1x: rounded(clamp(c1x + delta / 0.375, 0, 1)), c2x: 1 };
  if (drag.shape === '~-') return { c1x: 0, c2x: rounded(clamp(c2x + delta / 0.375, 0, 1)) };
  const shift = clamp(delta / 0.75, -Math.min(c1x, c2x), 1 - Math.max(c1x, c2x));
  return { c1x: rounded(c1x + shift), c2x: rounded(c2x + shift) };
}

export function useEdgeCurveDrag(canvasRef: React.RefObject<HTMLCanvasElement | null>): {
  onPointerDown: (e: PointerEvent) => boolean;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  cancel: () => void;
} {
  const activeDrag = useRef<CurveDrag | null>(null);
  const updatingControl = useRef(false);

  const cancel = useCallback(() => {
    const drag = activeDrag.current;
    activeDrag.current = null;
    const canvas = canvasRef.current;
    if (drag && canvas?.hasPointerCapture(drag.pointerId)) {
      canvas.releasePointerCapture(drag.pointerId);
    }
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const endPointer = (event: PointerEvent) => {
      if (event.pointerId === activeDrag.current?.pointerId) cancel();
    };
    canvas?.addEventListener('pointercancel', endPointer);
    canvas?.addEventListener('lostpointercapture', endPointer);
    window.addEventListener('blur', cancel);
    const unsubscribe = useStore.subscribe((state, previous) => {
      const drag = activeDrag.current;
      if (!drag || updatingControl.current) return;
      if (
        state.diagram !== drag.expectedDiagram
        || (state.view.selectedTool !== 'cursor' && state.view.selectedTool !== 'select')
        || state.view.sourceDraft !== previous.view.sourceDraft
        || state.view.zoom !== previous.view.zoom
        || state.view.scrollX !== previous.view.scrollX
        || state.view.scrollY !== previous.view.scrollY
        || state.view.collapsedGroupIds !== previous.view.collapsedGroupIds
      ) cancel();
    });
    return () => {
      unsubscribe();
      canvas?.removeEventListener('pointercancel', endPointer);
      canvas?.removeEventListener('lostpointercapture', endPointer);
      window.removeEventListener('blur', cancel);
      cancel();
    };
  }, [canvasRef, cancel]);

  const onPointerDown = useCallback((e: PointerEvent): boolean => {
    if (e.button !== 0 || activeDrag.current) return false;
    const { diagram, view } = useStore.getState();
    if (view.selectedTool !== 'cursor' && view.selectedTool !== 'select') return false;
    const index = hitTestEdgeCurveHandle(e.offsetX, e.offsetY);
    if (index === null) return false;
    const edge = diagram.edges[index];
    if (!edge) return false;
    const parsed = parseEdge(edge);
    if (!parsed) return false;
    const anchors = resolveEdgeAnchors(diagram, view, parsed, buildNodeIndex(
      diagram.signals, diagram.compatibility?.extensionsEnabled === true,
    ));
    if (!anchors) return false;
    const control = diagram.edgeCurveControls?.[index] ?? defaultCurveControl(parsed.shape);
    activeDrag.current = {
      pointerId: e.pointerId,
      index,
      edge,
      expectedDiagram: diagram,
      startX: e.offsetX,
      dx: anchors.to.x - anchors.from.x,
      shape: parsed.shape,
      startControl: { ...control },
      currentControl: { ...control },
      changed: false,
    };
    canvasRef.current?.setPointerCapture(e.pointerId);
    e.preventDefault();
    return true;
  }, [canvasRef]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = activeDrag.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { diagram, view, setEdgeCurveControl } = useStore.getState();
    // Document replacement, undo, or edge deletion must never reuse an old index.
    if (diagram !== drag.expectedDiagram || diagram.edges?.[drag.index] !== drag.edge
      || (view.selectedTool !== 'cursor' && view.selectedTool !== 'select')) {
      cancel();
      return;
    }
    if (!Number.isFinite(e.offsetX)) return;
    const control = controlFromDelta(drag, e.offsetX);
    if (control.c1x === drag.currentControl.c1x && control.c2x === drag.currentControl.c2x) return;
    updatingControl.current = true;
    try {
      setEdgeCurveControl(drag.index, control, { recordHistory: !drag.changed });
      drag.expectedDiagram = useStore.getState().diagram;
      drag.currentControl = control;
      drag.changed = true;
    } finally {
      updatingControl.current = false;
    }
  }, [cancel]);

  const onPointerUp = useCallback((e: PointerEvent) => {
    if (e.pointerId === activeDrag.current?.pointerId) cancel();
  }, [cancel]);

  return { onPointerDown, onPointerMove, onPointerUp, cancel };
}
