import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../shared/store';
import type { Tool } from '../shared/types';
import type { HitTestResult } from '../renderer/hitTest';
import {
  allocateNodeChar,
  formatArrowEdge,
  formatTimespanEdge,
} from '../wavedromBridge/nodeString';
import { flushPendingCodeToDiagram } from './codeFlush';

const EDGE_TOOLS: Tool[] = ['arrow', 'timespan'];

export interface EdgeAnchorPending {
  char: string;
  signalId: string;
  step: number;
}

export interface EdgePreview {
  edgeStr: string;
}

function isEdgeTool(tool: Tool): boolean {
  return EDGE_TOOLS.includes(tool);
}

export function useEdgeTools(): {
  isEdgeToolActive: boolean;
  edgePending: EdgeAnchorPending | null;
  edgePreview: EdgePreview | null;
  cancelEdgeEdit: () => void;
  onPointerDown: (e: PointerEvent, hit: HitTestResult) => void;
  onPointerMove: (e: PointerEvent, hit: HitTestResult) => void;
  onPointerUp: (e: PointerEvent, hit: HitTestResult) => void;
} {
  const tool = useStore((s) => s.view.selectedTool);
  const setSignalNodeAt = useStore((s) => s.setSignalNodeAt);
  const addDiagramEdge = useStore((s) => s.addDiagramEdge);

  const [edgePending, setEdgePending] = useState<EdgeAnchorPending | null>(null);
  const [edgePreview, setEdgePreview] = useState<EdgePreview | null>(null);
  const timespanDragRef = useRef<{
    signalId: string;
    startStep: number;
  } | null>(null);

  const cancelEdgeEdit = useCallback(() => {
    setEdgePending(null);
    setEdgePreview(null);
    timespanDragRef.current = null;
  }, []);

  const placeAnchor = useCallback(
    (signalId: string, step: number): string | null => {
      const diagram = useStore.getState().diagram;
      const ch = allocateNodeChar(diagram);
      if (!ch) return null;
      setSignalNodeAt(signalId, step, ch);
      return ch;
    },
    [setSignalNodeAt],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent, hit: HitTestResult) => {
      if (!isEdgeTool(tool)) return;
      flushPendingCodeToDiagram();
      if (!hit.signalId || hit.signalType === 'group' || hit.step === null) return;

      if (tool === 'timespan') {
        timespanDragRef.current = { signalId: hit.signalId, startStep: hit.step };
        return;
      }

      if (e.shiftKey && edgePending) {
        setSignalNodeAt(edgePending.signalId, edgePending.step, null);
        cancelEdgeEdit();
        return;
      }

      if (!edgePending) {
        const ch = placeAnchor(hit.signalId, hit.step);
        if (!ch) return;
        setEdgePending({ char: ch, signalId: hit.signalId, step: hit.step });
        return;
      }

      const toChar = placeAnchor(hit.signalId, hit.step);
      if (!toChar) return;
      addDiagramEdge(formatArrowEdge(edgePending.char, toChar));
      cancelEdgeEdit();
    },
    [tool, edgePending, placeAnchor, setSignalNodeAt, addDiagramEdge, cancelEdgeEdit],
  );

  const onPointerMove = useCallback(() => {
    setEdgePreview(null);
  }, []);

  const onPointerUp = useCallback(
    (_e: PointerEvent, hit: HitTestResult) => {
      if (tool !== 'timespan') return;
      const drag = timespanDragRef.current;
      timespanDragRef.current = null;
      setEdgePreview(null);
      if (!drag || !hit.signalId || hit.step === null) return;

      const lo = Math.min(drag.startStep, hit.step);
      const hi = Math.max(drag.startStep, hit.step);
      if (lo === hi) return;

      const signalId = drag.signalId;
      const fromChar = placeAnchor(signalId, lo);
      const toChar = placeAnchor(signalId, hi);
      if (!fromChar || !toChar) return;

      const label =
        typeof window !== 'undefined'
          ? window.prompt('Timespan label (WaveDrom edge label, e.g. "5 ms"):', '5 ms')
          : '5 ms';
      if (label === null) {
        setSignalNodeAt(signalId, lo, null);
        setSignalNodeAt(signalId, hi, null);
        return;
      }
      addDiagramEdge(formatTimespanEdge(fromChar, toChar, label));
    },
    [tool, placeAnchor, setSignalNodeAt, addDiagramEdge],
  );

  useEffect(() => {
    if (!isEdgeTool(tool)) cancelEdgeEdit();
  }, [tool, cancelEdgeEdit]);

  return {
    isEdgeToolActive: isEdgeTool(tool),
    edgePending,
    edgePreview,
    cancelEdgeEdit,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
