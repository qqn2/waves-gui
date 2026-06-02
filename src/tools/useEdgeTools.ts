import { useCallback, useEffect } from 'react';
import { useStore } from '../shared/store';
import type { Tool } from '../shared/types';
import type { HitTestResult } from '../renderer/hitTest';
import {
  allocateNodeChar,
  formatArrowEdge,
  formatTimespanEdge,
} from '../wavedromBridge/nodeString';
import { flushPendingCodeToDiagram } from './codeFlush';
import { edgeToolHint } from './edgeToolHint';

const EDGE_TOOLS: Tool[] = ['arrow', 'timespan'];

function isEdgeTool(tool: Tool): boolean {
  return EDGE_TOOLS.includes(tool);
}

export function useEdgeTools(): {
  isEdgeToolActive: boolean;
  edgeHint: string | null;
  cancelEdgeEdit: () => void;
  onPointerDown: (e: PointerEvent, hit: HitTestResult) => void;
  onPointerMove: (_e: PointerEvent, _hit: HitTestResult) => void;
  onPointerUp: (e: PointerEvent, hit: HitTestResult) => void;
} {
  const tool = useStore((s) => s.view.selectedTool);
  const edgeAnchorPending = useStore((s) => s.view.edgeAnchorPending);
  const setEdgeAnchorPending = useStore((s) => s.setEdgeAnchorPending);
  const setEdgeToolHover = useStore((s) => s.setEdgeToolHover);
  const setSignalNodeAt = useStore((s) => s.setSignalNodeAt);
  const addDiagramEdge = useStore((s) => s.addDiagramEdge);
  const activeTimespanLabel = useStore((s) => s.view.activeTimespanLabel);

  const cancelEdgeEdit = useCallback(() => {
    setEdgeAnchorPending(null);
    setEdgeToolHover(null);
  }, [setEdgeAnchorPending, setEdgeToolHover]);

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
      if (e.button === 2) return;

      if (tool === 'timespan') {
        if (hit.signalType !== 'bit' && hit.signalType !== 'vector') return;
        const fromChar = placeAnchor(hit.signalId, hit.step);
        if (!fromChar) return;
        setEdgeAnchorPending({
          kind: 'timespan',
          signalId: hit.signalId,
          startStep: hit.step,
          fromChar,
        });
        return;
      }

      if (e.shiftKey && edgeAnchorPending?.kind === 'arrow') {
        setSignalNodeAt(
          edgeAnchorPending.signalId,
          edgeAnchorPending.step,
          null,
        );
        cancelEdgeEdit();
        return;
      }

      if (!edgeAnchorPending || edgeAnchorPending.kind !== 'arrow') {
        const ch = placeAnchor(hit.signalId, hit.step);
        if (!ch) return;
        setEdgeAnchorPending({
          kind: 'arrow',
          char: ch,
          signalId: hit.signalId,
          step: hit.step,
        });
        return;
      }

      const toChar = placeAnchor(hit.signalId, hit.step);
      if (!toChar) return;
      addDiagramEdge(
        formatArrowEdge(edgeAnchorPending.char, toChar),
      );
      cancelEdgeEdit();
    },
    [
      tool,
      edgeAnchorPending,
      placeAnchor,
      setSignalNodeAt,
      addDiagramEdge,
      cancelEdgeEdit,
      setEdgeAnchorPending,
    ],
  );

  const onPointerMove = useCallback(
    (_e: PointerEvent, hit: HitTestResult) => {
      if (!isEdgeTool(tool)) return;
      if (!hit.signalId || hit.step === null || hit.signalType === 'group') {
        setEdgeToolHover(null);
        return;
      }
      if (tool === 'timespan' && hit.signalType !== 'bit' && hit.signalType !== 'vector') {
        setEdgeToolHover(null);
        return;
      }
      setEdgeToolHover({ signalId: hit.signalId, step: hit.step });
    },
    [tool, setEdgeToolHover],
  );

  const onPointerUp = useCallback(
    (_e: PointerEvent, hit: HitTestResult) => {
      if (tool !== 'timespan') return;
      const pending = useStore.getState().view.edgeAnchorPending;
      if (!pending || pending.kind !== 'timespan') return;
      if (!hit.signalId || hit.step === null) {
        setSignalNodeAt(pending.signalId, pending.startStep, null);
        cancelEdgeEdit();
        return;
      }
      if (hit.signalId !== pending.signalId) {
        setSignalNodeAt(pending.signalId, pending.startStep, null);
        cancelEdgeEdit();
        return;
      }

      const lo = Math.min(pending.startStep, hit.step);
      const hi = Math.max(pending.startStep, hit.step);
      if (lo === hi) {
        setSignalNodeAt(pending.signalId, pending.startStep, null);
        cancelEdgeEdit();
        return;
      }

      const toChar = placeAnchor(pending.signalId, hi);
      if (!toChar) {
        setSignalNodeAt(pending.signalId, pending.startStep, null);
        cancelEdgeEdit();
        return;
      }

      const label = activeTimespanLabel.trim() || '5 ms';
      addDiagramEdge(formatTimespanEdge(pending.fromChar, toChar, label));
      cancelEdgeEdit();
    },
    [
      tool,
      placeAnchor,
      setSignalNodeAt,
      addDiagramEdge,
      cancelEdgeEdit,
      activeTimespanLabel,
    ],
  );

  useEffect(() => {
    if (!isEdgeTool(tool)) cancelEdgeEdit();
  }, [tool, cancelEdgeEdit]);

  return {
    isEdgeToolActive: isEdgeTool(tool),
    edgeHint: edgeToolHint(tool, edgeAnchorPending, activeTimespanLabel),
    cancelEdgeEdit,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
