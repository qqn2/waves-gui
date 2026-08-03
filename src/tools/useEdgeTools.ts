import { useCallback, useEffect } from 'react';
import { useStore } from '../shared/store';
import type { Tool, ViewState } from '../shared/types';
import type { HitTestResult } from '../renderer/hitTest';
import {
  allocateNodeChar,
  findSignalInDiagram,
  formatTimespanEdge,
  visibleNodeCharAt,
} from '../wavedromBridge/nodeString';
import { flushPendingCodeToDiagram } from './codeFlush';
import { edgeToolHint } from './edgeToolHint';
import { MIXED_WAVE_NOTICE } from '../shared/mixedWave';

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
  onPointerUp: (e: PointerEvent, hit: HitTestResult) => void;
} {
  const tool = useStore((s) => s.view.selectedTool);
  const edgeAnchorPending = useStore((s) => s.view.edgeAnchorPending);
  const setEdgeAnchorPending = useStore((s) => s.setEdgeAnchorPending);
  const setEdgeToolHover = useStore((s) => s.setEdgeToolHover);
  const setSignalNodeAt = useStore((s) => s.setSignalNodeAt);
  const addDiagramEdge = useStore((s) => s.addDiagramEdge);
  const addDiagramArrow = useStore((s) => s.addDiagramArrow);
  const activeTimespanLabel = useStore((s) => s.view.activeTimespanLabel);
  const activeEdgeConnector = useStore((s) => s.view.activeEdgeConnector);
  const activeEdgeLabel = useStore((s) => s.view.activeEdgeLabel);

  const cancelEdgeEdit = useCallback(() => {
    setEdgeAnchorPending(null);
    setEdgeToolHover(null);
  }, [setEdgeAnchorPending, setEdgeToolHover]);

  const placeAnchor = useCallback(
    (signalId: string, step: number): string | null => {
      const diagram = useStore.getState().diagram;
      const signal = findSignalInDiagram(diagram, signalId);
      if (!signal || signal.type === 'spacer') return null;
      if (signal.sourceWaveData) {
        useStore.getState().setOperationNotice(MIXED_WAVE_NOTICE);
        return null;
      }

      const existing = visibleNodeCharAt(signal, step, diagram.config.totalSteps);
      if (existing) return existing;

      const ch = allocateNodeChar(diagram);
      if (!ch) return null;
      return setSignalNodeAt(signalId, step, ch) ? ch : null;
    },
    [setSignalNodeAt],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent, hit: HitTestResult) => {
      if (!isEdgeTool(tool)) return;
      if (!flushPendingCodeToDiagram().ok) return;
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

      if (!hit.signalId || hit.signalType === 'group' || hit.step === null) {
        cancelEdgeEdit();
        return;
      }

      const diagram = useStore.getState().diagram;
      const signal = findSignalInDiagram(diagram, hit.signalId);
      if (!signal || signal.type === 'spacer') return;
      if (signal.sourceWaveData) {
        useStore.getState().setOperationNotice(MIXED_WAVE_NOTICE);
        cancelEdgeEdit();
        return;
      }
      const char =
        visibleNodeCharAt(signal, hit.step, diagram.config.totalSteps)
        ?? allocateNodeChar(diagram);
      if (!char) return;

      setEdgeAnchorPending({
        kind: 'arrow',
        char,
        signalId: hit.signalId,
        step: hit.step,
      });
      setEdgeToolHover(pointerHover(hit, e.offsetX, e.offsetY, 'arrow'));
    },
    [
      tool,
      placeAnchor,
      setSignalNodeAt,
      addDiagramEdge,
      cancelEdgeEdit,
      setEdgeAnchorPending,
      setEdgeToolHover,
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

  const onPointerUp = useCallback(
    (_e: PointerEvent, hit: HitTestResult) => {
      if (tool !== 'arrow') return;
      const pending = useStore.getState().view.edgeAnchorPending;
      if (
        pending?.kind === 'arrow'
        && hit.signalId
        && hit.signalType !== 'group'
        && hit.step !== null
        && (hit.signalId !== pending.signalId || hit.step !== pending.step)
      ) {
        addDiagramArrow(
          { signalId: pending.signalId, step: pending.step },
          { signalId: hit.signalId, step: hit.step },
          activeEdgeConnector,
          activeEdgeLabel,
        );
      }
      cancelEdgeEdit();
    },
    [tool, addDiagramArrow, activeEdgeConnector, activeEdgeLabel, cancelEdgeEdit],
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
