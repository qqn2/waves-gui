import { useCallback, useRef } from 'react';
import { useStore, pushHistory } from '../shared/store';
import {
  buildNodeIndex,
  cubicMidpoint,
  defaultCurveControl,
  isCurvyEdgeShape,
  parseEdge,
  resolveEdgeAnchors,
} from '../renderer/edgeLayout';

const HANDLE_HIT_PX = 10;

export function hitTestEdgeCurveHandle(
  canvasX: number,
  canvasY: number,
): number | null {
  const { diagram, view } = useStore.getState();
  const edges = diagram.edges ?? [];
  const controls = diagram.edgeCurveControls ?? {};
  const nodeIndex = buildNodeIndex(diagram.signals);

  for (let i = edges.length - 1; i >= 0; i--) {
    const parsed = parseEdge(edges[i]!);
    if (!parsed || !isCurvyEdgeShape(parsed.shape)) continue;
    const anchors = resolveEdgeAnchors(diagram, view, parsed, nodeIndex);
    if (!anchors) continue;
    const curve = controls[i] ?? defaultCurveControl(parsed.shape);
    const dx = anchors.to.x - anchors.from.x;
    const dy = anchors.to.y - anchors.from.y;
    const c1x = anchors.from.x + curve.c1x * dx;
    const c1y = anchors.from.y;
    const c2x = anchors.from.x + curve.c2x * dx;
    const c2y = anchors.from.y + dy;
    const mid = cubicMidpoint(anchors.from, anchors.to, c1x, c1y, c2x, c2y);
    if (Math.hypot(canvasX - mid.x, canvasY - mid.y) <= HANDLE_HIT_PX) return i;
  }
  return null;
}

function controlFromPointer(
  fromX: number,
  _fromY: number,
  toX: number,
  _toY: number,
  px: number,
  _py: number,
  shape: string,
): { c1x: number; c2x: number } {
  const dx = toX - fromX;
  if (Math.abs(dx) < 1) return defaultCurveControl(shape);
  const t = Math.max(0.15, Math.min(0.85, (px - fromX) / dx));
  const c1x = t;
  const c2x = Math.max(0.05, Math.min(0.95, 1 - t));
  if (shape.startsWith('-~')) return { c1x, c2x: 1 };
  if (shape.endsWith('~-')) return { c1x: 0, c2x };
  return { c1x, c2x };
}

export function useEdgeCurveDrag(canvasRef: React.RefObject<HTMLCanvasElement | null>): {
  onPointerDown: (e: PointerEvent) => boolean;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
} {
  const dragIndex = useRef<number | null>(null);

  const onPointerDown = useCallback((e: PointerEvent): boolean => {
    const tool = useStore.getState().view.selectedTool;
    if (tool !== 'cursor' && tool !== 'select') return false;
    const idx = hitTestEdgeCurveHandle(e.offsetX, e.offsetY);
    if (idx === null) return false;
    dragIndex.current = idx;
    useStore.setState((s) => {
      pushHistory(s);
    });
    const canvas = canvasRef.current;
    canvas?.setPointerCapture(e.pointerId);
    e.preventDefault();
    return true;
  }, [canvasRef]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (dragIndex.current === null) return;
    const i = dragIndex.current;
    const { diagram, view, setEdgeCurveControl } = useStore.getState();
    const parsed = parseEdge(diagram.edges[i]!);
    if (!parsed) return;
    const nodeIndex = buildNodeIndex(diagram.signals);
    const anchors = resolveEdgeAnchors(diagram, view, parsed, nodeIndex);
    if (!anchors) return;
    const control = controlFromPointer(
      anchors.from.x,
      anchors.from.y,
      anchors.to.x,
      anchors.to.y,
      e.offsetX,
      e.offsetY,
      parsed.shape,
    );
    setEdgeCurveControl(i, control, { recordHistory: false });
  }, []);

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      if (dragIndex.current === null) return;
      dragIndex.current = null;
      const canvas = canvasRef.current;
      if (canvas?.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    },
    [canvasRef],
  );

  return { onPointerDown, onPointerMove, onPointerUp };
}
