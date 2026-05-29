import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { CELL_WIDTH, DEFAULT_SIGNAL_COLOR, TIME_AXIS_HEIGHT } from '../shared/constants';
import { useStore } from '../shared/store';
import type {
  ArrowAnnotation,
  TextAnnotation,
  TimeMarkerAnnotation,
  TimeSpanAnnotation,
  Tool,
} from '../shared/types';
import {
  canvasToLogicalX,
  canvasToLogicalY,
  type ViewTransform,
} from '../renderer/coordinates';
import type { HitTestResult } from '../renderer/hitTest';
import { toolState } from '../tools/toolState';
import { flushPendingCodeToDiagram } from '../tools/codeFlush';

const ANNOTATION_TOOLS: Tool[] = ['arrow', 'timespan', 'marker', 'text'];

function newId(): string {
  return `ann-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
}

function clampStep(step: number, totalSteps: number): number {
  return Math.max(0, Math.min(totalSteps - 1, step));
}

function logicalPoint(
  canvasX: number,
  canvasY: number,
  transform: ViewTransform,
  axisOffset: number,
): { lx: number; ly: number; step: number } {
  const lx = canvasToLogicalX(canvasX, transform);
  const ly = canvasToLogicalY(canvasY - axisOffset, transform);
  const step = Math.floor(lx / CELL_WIDTH);
  return { lx, ly, step };
}

export type AnnotationCreationDraft =
  | {
      type: 'arrow';
      fromSignalId: string;
      fromStep: number;
      toSignalId: string;
      toStep: number;
    }
  | {
      type: 'timespan';
      startStep: number;
      endStep: number;
    };

function isAnnotationTool(tool: Tool): boolean {
  return ANNOTATION_TOOLS.includes(tool);
}

export function useAnnotationTools(_canvasRef: RefObject<HTMLCanvasElement | null>): {
  creationDraft: AnnotationCreationDraft | null;
  isAnnotationToolActive: boolean;
  onPointerDown: (e: PointerEvent, hit: HitTestResult) => void;
  onPointerMove: (e: PointerEvent, hit: HitTestResult) => void;
  onPointerUp: (e: PointerEvent, hit: HitTestResult) => void;
} {
  const tool = useStore((s) => s.view.selectedTool);
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);
  const addAnnotation = useStore((s) => s.addAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);

  const [creationDraft, setCreationDraft] = useState<AnnotationCreationDraft | null>(null);
  const dragRef = useRef<{
    kind: 'arrow' | 'timespan';
    anchorSignalId?: string;
    anchorStep?: number;
  } | null>(null);

  const transform: ViewTransform = {
    zoom: view.zoom,
    hscale: diagram.config.hscale,
    scrollX: view.scrollX,
    scrollY: view.scrollY,
  };
  const axisOffset = view.showTimeAxis ? TIME_AXIS_HEIGHT : 0;
  const totalSteps = diagram.config.totalSteps;

  const onPointerDown = useCallback(
    (e: PointerEvent, hit: HitTestResult) => {
      if (!isAnnotationTool(tool)) return;
      flushPendingCodeToDiagram();
      const { step } = logicalPoint(e.offsetX, e.offsetY, transform, axisOffset);
      const clamped = clampStep(step, totalSteps);

      if (tool === 'marker') {
        addAnnotation({
          id: newId(),
          type: 'marker',
          step: clamped,
          color: DEFAULT_SIGNAL_COLOR,
        } satisfies TimeMarkerAnnotation);
        return;
      }

      if (tool === 'text') {
        if (!hit.signalId || hit.signalType === 'group') return;
        addAnnotation({
          id: newId(),
          type: 'text',
          signalId: hit.signalId,
          step: clamped,
          text: 'label',
          color: DEFAULT_SIGNAL_COLOR,
        } satisfies TextAnnotation);
        return;
      }

      if (tool === 'arrow') {
        if (!hit.signalId || hit.signalType === 'group') return;
        dragRef.current = { kind: 'arrow', anchorSignalId: hit.signalId, anchorStep: clamped };
        setCreationDraft({
          type: 'arrow',
          fromSignalId: hit.signalId,
          fromStep: clamped,
          toSignalId: hit.signalId,
          toStep: clamped,
        });
        return;
      }

      if (tool === 'timespan') {
        dragRef.current = { kind: 'timespan', anchorStep: clamped };
        setCreationDraft({
          type: 'timespan',
          startStep: clamped,
          endStep: clamped,
        });
      }
    },
    [tool, transform, axisOffset, totalSteps, addAnnotation],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent, hit: HitTestResult) => {
      if (!dragRef.current) return;
      const { step } = logicalPoint(e.offsetX, e.offsetY, transform, axisOffset);
      const clamped = clampStep(step, totalSteps);

      if (dragRef.current.kind === 'arrow' && creationDraft?.type === 'arrow') {
        const toSignalId =
          hit.signalId && hit.signalType !== 'group'
            ? hit.signalId
            : creationDraft.toSignalId;
        setCreationDraft({
          type: 'arrow',
          fromSignalId: creationDraft.fromSignalId,
          fromStep: creationDraft.fromStep,
          toSignalId,
          toStep: clamped,
        });
        return;
      }

      if (dragRef.current.kind === 'timespan' && creationDraft?.type === 'timespan') {
        const start = dragRef.current.anchorStep ?? clamped;
        setCreationDraft({
          type: 'timespan',
          startStep: Math.min(start, clamped),
          endStep: Math.max(start, clamped),
        });
      }
    },
    [creationDraft, transform, axisOffset, totalSteps],
  );

  const onPointerUp = useCallback(
    (_e: PointerEvent, hit: HitTestResult) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag || !creationDraft) {
        setCreationDraft(null);
        return;
      }

      if (creationDraft.type === 'arrow') {
        const toSignalId =
          hit.signalId && hit.signalType !== 'group'
            ? hit.signalId
            : creationDraft.toSignalId;
        if (toSignalId && creationDraft.fromSignalId) {
          addAnnotation({
            id: newId(),
            type: 'arrow',
            fromSignalId: creationDraft.fromSignalId,
            fromStep: creationDraft.fromStep,
            toSignalId,
            toStep: creationDraft.toStep,
            color: DEFAULT_SIGNAL_COLOR,
          } satisfies ArrowAnnotation);
        }
      } else if (creationDraft.type === 'timespan') {
        if (creationDraft.endStep !== creationDraft.startStep) {
          addAnnotation({
            id: newId(),
            type: 'timespan',
            startStep: creationDraft.startStep,
            endStep: creationDraft.endStep,
            color: DEFAULT_SIGNAL_COLOR,
            row: 'top',
          } satisfies TimeSpanAnnotation);
        }
      }

      setCreationDraft(null);
    },
    [creationDraft, addAnnotation],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const selectedId = toolState.getSelectedAnnotationId();
      if (!selectedId) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      e.preventDefault();
      removeAnnotation(selectedId);
      toolState.setSelectedAnnotationId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [removeAnnotation]);

  useEffect(() => {
    if (!isAnnotationTool(tool)) {
      dragRef.current = null;
      setCreationDraft(null);
    }
  }, [tool]);

  return {
    creationDraft,
    isAnnotationToolActive: isAnnotationTool(tool),
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
