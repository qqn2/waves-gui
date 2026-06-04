import { useCallback, useEffect } from 'react';
import { useStore } from '../shared/store';
import type { Tool, ViewState } from '../shared/types';
import type { HitTestResult } from '../renderer/hitTest';
import {
  allocateNodeChar,
  findSignalInDiagram,
  formatArrowEdge,
  formatTimespanEdge,
  visibleNodeCharAt,
} from '../wavedromBridge/nodeString';
import { flushPendingCodeToDiagram } from './codeFlush';
import { edgeToolHint } from './edgeToolHint';

const EDGE_TOOLS: Tool[] = ['arrow', 'timespan'];

function isEdgeTool(tool: Tool): boolean {
  return EDGE_TOOLS.includes(tool);
}

function pointerHover(
  hit: HitTestResult,
  canvasX: number,
  canvasY: number,
  laneOnly: 'arrow' | 'timespan',
): ViewState['edgeToolHover'] {
  const onLane =
    hit.signalId !== null &&
    hit.step !== null &&
    hit.signalType !== 'group' &&
    (laneOnly === 'arrow' ||
      hit.signalType === 'bit' ||
      hit.signalType === 'vector');
  return {
    signalId: onLane ? hit.signalId : null,
    step: onLane ? hit.step : null,
    canvasX,
    canvasY,
  };
}

export function useEdgeTools(): {
  isEdgeToolActive: boolean;
  edgeHint: string | null;
  cancelEdgeEdit: () => void;
  onPointerDown: (e: PointerEvent, hit: HitTestResult) => void;
  onPointerMove: (e: PointerEvent, hit: HitTestResult) => void;
  onPointerUp: (_e: PointerEvent, _hit: HitTestResult) => void;
} {
  const tool = useStore((s) => s.view.selectedTool);
  const edgeAnchorPending = useStore((s) => s.view.edgeAnchorPending);
  const setEdgeAnchorPending = useStore((s) => s.setEdgeAnchorPending);
  const setEdgeToolHover = useStore((s) => s.setEdgeToolHover);
  const setSignalNodeAt = useStore((s) => s.setSignalNodeAt);
  const addDiagramEdge = useStore((s) => s.addDiagramEdge);
  const activeTimespanLabel = useStore((s) => s.view.activeTimespanLabel);
  const activeEdgeShape = useStore((s) => s.view.activeEdgeShape);

  const cancelEdgeEdit = useCallback(() => {
    setEdgeAnchorPending(null);
    setEdgeToolHover(null);
  }, [setEdgeAnchorPending, setEdgeToolHover]);

  const placeAnchor = useCallback(
    (signalId: string, step: number): string | null => {
      const diagram = useStore.getState().diagram;
      const signal = findSignalInDiagram(diagram, signalId);
      if (!signal || signal.type === 'spacer') return null;

      const existing = visibleNodeCharAt(signal, step, diagram.config.totalSteps);
      if (existing) return existing;

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
      if (e.button === 2) return;

      const pending = useStore.getState().view.edgeAnchorPending;

      if (tool === 'timespan') {
        if (e.shiftKey && pending?.kind === 'timespan') {
          setSignalNodeAt(pending.signalId, pending.startStep, null);
          cancelEdgeEdit();
          return;
        }

        if (!pending || pending.kind !== 'timespan') {
          if (!hit.signalId || hit.signalType === 'group' || hit.step === null) return;
          if (hit.signalType !== 'bit' && hit.signalType !== 'vector') return;
          const fromChar = placeAnchor(hit.signalId, hit.step);
          if (!fromChar) return;
          setEdgeAnchorPending({
            kind: 'timespan',
            signalId: hit.signalId,
            startStep: hit.step,
            fromChar,
          });
          setEdgeToolHover(pointerHover(hit, e.offsetX, e.offsetY, 'timespan'));
          return;
        }

        if (
          !hit.signalId ||
          hit.step === null ||
          hit.signalType === 'group' ||
          (hit.signalType !== 'bit' && hit.signalType !== 'vector')
        ) {
          setSignalNodeAt(pending.signalId, pending.startStep, null);
          cancelEdgeEdit();
          return;
        }

        if (hit.signalId !== pending.signalId) {
          setSignalNodeAt(pending.signalId, pending.startStep, null);
          cancelEdgeEdit();
          return;
        }

        if (hit.step === pending.startStep) return;

        const hi = Math.max(pending.startStep, hit.step);
        const toChar = placeAnchor(pending.signalId, hi);
        if (!toChar || toChar === pending.fromChar) {
          setSignalNodeAt(pending.signalId, pending.startStep, null);
          cancelEdgeEdit();
          return;
        }

        const label = activeTimespanLabel.trim() || '5 ms';
        addDiagramEdge(formatTimespanEdge(pending.fromChar, toChar, label));
        cancelEdgeEdit();
        return;
      }

      if (!hit.signalId || hit.signalType === 'group' || hit.step === null) return;

      if (e.shiftKey && pending?.kind === 'arrow') {
        setSignalNodeAt(pending.signalId, pending.step, null);
        cancelEdgeEdit();
        return;
      }

      if (!pending || pending.kind !== 'arrow') {
        const ch = placeAnchor(hit.signalId, hit.step);
        if (!ch) return;
        setEdgeAnchorPending({
          kind: 'arrow',
          char: ch,
          signalId: hit.signalId,
          step: hit.step,
        });
        setEdgeToolHover(pointerHover(hit, e.offsetX, e.offsetY, 'arrow'));
        return;
      }

      if (
        hit.signalId === pending.signalId &&
        hit.step === pending.step
      ) {
        return;
      }

      const toChar = placeAnchor(hit.signalId, hit.step);
      if (!toChar || toChar === pending.char) return;

      addDiagramEdge(
        formatArrowEdge(pending.char, toChar, undefined, activeEdgeShape),
      );
      cancelEdgeEdit();
    },
    [
      tool,
      placeAnchor,
      setSignalNodeAt,
      addDiagramEdge,
      cancelEdgeEdit,
      setEdgeAnchorPending,
      setEdgeToolHover,
      activeEdgeShape,
      activeTimespanLabel,
    ],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent, hit: HitTestResult) => {
      if (!isEdgeTool(tool)) return;
      setEdgeToolHover(
        pointerHover(hit, e.offsetX, e.offsetY, tool === 'timespan' ? 'timespan' : 'arrow'),
      );
    },
    [tool, setEdgeToolHover],
  );

  const onPointerUp = useCallback((_e: PointerEvent, _hit: HitTestResult) => {
    // Arrow and timespan complete on click — no drag / pointer-up gesture.
  }, []);

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
