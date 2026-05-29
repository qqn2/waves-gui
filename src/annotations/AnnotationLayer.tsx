import { useCallback, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CELL_WIDTH, DEFAULT_SIGNAL_COLOR, TIME_AXIS_HEIGHT } from '../shared/constants';
import { useStore } from '../shared/store';
import type { Annotation, SignalOrGroup } from '../shared/types';
import type { ViewTransform } from '../renderer/coordinates';
import {
  canvasToLogicalX,
  canvasToLogicalY,
} from '../renderer/coordinates';
import { toolState } from '../tools/toolState';
import { ArrowAnnotationEl } from './ArrowAnnotation';
import { TimeMarkerAnnotationEl } from './TimeMarkerAnnotation';
import { TimeSpanAnnotationEl } from './TimeSpanAnnotation';
import { TextAnnotationEl } from './TextAnnotationEl';
import type { AnnotationCreationDraft } from './useAnnotationTools';
import { diagramContentHeight } from './annotationGeometry';
import { hitTestAnnotations } from './hitTestAnnotations';
import styles from './AnnotationLayer.module.css';

export interface AnnotationLayerProps {
  width: number;
  height: number;
  creationDraft?: AnnotationCreationDraft | null;
}

type DragEdit =
  | {
      annotationId: string;
      handle: string;
      kind: Annotation['type'];
    }
  | null;

function clampStep(step: number, totalSteps: number): number {
  return Math.max(0, Math.min(totalSteps - 1, step));
}

function renderDraft(
  draft: AnnotationCreationDraft,
  signals: SignalOrGroup[],
  contentHeight: number,
): JSX.Element {
  if (draft.type === 'arrow') {
    return (
      <ArrowAnnotationEl
        annotation={{
          id: '__draft__',
          type: 'arrow',
          fromSignalId: draft.fromSignalId,
          fromStep: draft.fromStep,
          toSignalId: draft.toSignalId,
          toStep: draft.toStep,
          color: DEFAULT_SIGNAL_COLOR,
        }}
        signals={signals}
        showHandles={false}
      />
    );
  }
  return (
    <TimeSpanAnnotationEl
      annotation={{
        id: '__draft__',
        type: 'timespan',
        startStep: draft.startStep,
        endStep: draft.endStep,
        color: DEFAULT_SIGNAL_COLOR,
        row: 'top',
      }}
      contentHeight={contentHeight}
      showHandles={false}
    />
  );
}

export function AnnotationLayer({ width, height, creationDraft }: AnnotationLayerProps) {
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);
  const updateAnnotation = useStore((s) => s.updateAnnotation);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragEdit, setDragEdit] = useState<DragEdit>(null);
  const selectedId = toolState.getSelectedAnnotationId();

  const transform: ViewTransform = useMemo(
    () => ({
      zoom: view.zoom,
      hscale: diagram.config.hscale,
      scrollX: view.scrollX,
      scrollY: view.scrollY,
    }),
    [view.zoom, view.scrollX, view.scrollY, diagram.config.hscale],
  );

  const axisOffset = view.showTimeAxis ? TIME_AXIS_HEIGHT : 0;
  const contentHeight = diagramContentHeight(diagram.signals);
  const scaleX = view.zoom * diagram.config.hscale;
  const scaleY = view.zoom;

  const logicalFromCanvas = useCallback(
    (canvasX: number, canvasY: number) => ({
      lx: canvasToLogicalX(canvasX, transform),
      ly: canvasToLogicalY(canvasY - axisOffset, transform),
      step: clampStep(
        Math.floor(canvasToLogicalX(canvasX, transform) / CELL_WIDTH),
        diagram.config.totalSteps,
      ),
    }),
    [transform, axisOffset, diagram.config.totalSteps],
  );

  const showHandles = (id: string) => id === hoveredId || id === selectedId;

  const onSvgPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    if (dragEdit) {
      const { step } = logicalFromCanvas(cx, cy);
      const ann = diagram.annotations.find((a) => a.id === dragEdit.annotationId);
      if (!ann) return;
      if (ann.type === 'marker' && dragEdit.handle === 'step') {
        updateAnnotation(ann.id, { step });
      } else if (ann.type === 'timespan') {
        if (dragEdit.handle === 'start') {
          updateAnnotation(ann.id, { startStep: Math.min(step, ann.endStep) });
        } else if (dragEdit.handle === 'end') {
          updateAnnotation(ann.id, { endStep: Math.max(step, ann.startStep) });
        }
      } else if (ann.type === 'arrow') {
        if (dragEdit.handle === 'from') {
          updateAnnotation(ann.id, { fromStep: step });
        } else if (dragEdit.handle === 'to') {
          updateAnnotation(ann.id, { toStep: step });
        }
      } else if (ann.type === 'text' && dragEdit.handle === 'position') {
        updateAnnotation(ann.id, { step });
      }
      return;
    }
    const annId = hitTestAnnotations(cx, cy, diagram, transform, axisOffset);
    setHoveredId(annId);
  };

  const onSvgPointerUp = () => {
    setDragEdit(null);
  };

  const onHandlePointerDown = (
    e: ReactPointerEvent<SVGElement>,
    annotationId: string,
    handle: string,
    kind: Annotation['type'],
  ) => {
    e.stopPropagation();
    toolState.setSelectedAnnotationId(annotationId);
    setDragEdit({ annotationId, handle, kind });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const renderOne = (ann: Annotation) => {
    const handles = showHandles(ann.id);
    const handleProps = handles
      ? {
          onPointerDownCapture: (e: ReactPointerEvent<SVGElement>) => {
            const target = (e.target as SVGElement).closest('.ann-handle');
            if (!target) return;
            const handle = target.getAttribute('data-handle');
            if (!handle) return;
            onHandlePointerDown(e, ann.id, handle, ann.type);
          },
        }
      : {};

    switch (ann.type) {
      case 'arrow':
        return (
          <g key={ann.id} {...handleProps} className={handles ? styles.interactive : undefined}>
            <ArrowAnnotationEl annotation={ann} signals={diagram.signals} showHandles={handles} />
          </g>
        );
      case 'marker':
        return (
          <g key={ann.id} {...handleProps} className={handles ? styles.interactive : undefined}>
            <TimeMarkerAnnotationEl
              annotation={ann}
              contentHeight={contentHeight}
              showHandles={handles}
            />
          </g>
        );
      case 'timespan':
        return (
          <g key={ann.id} {...handleProps} className={handles ? styles.interactive : undefined}>
            <TimeSpanAnnotationEl
              annotation={ann}
              contentHeight={contentHeight}
              showHandles={handles}
            />
          </g>
        );
      case 'text':
        return (
          <g key={ann.id} {...handleProps} className={handles ? styles.interactive : undefined}>
            <TextAnnotationEl
              annotation={ann}
              signals={diagram.signals}
              showHandles={handles}
              onTextChange={(text) => updateAnnotation(ann.id, { text })}
            />
          </g>
        );
    }
  };

  return (
    <svg
      className={styles.layer}
      width={width}
      height={height}
      aria-hidden
      onPointerMove={onSvgPointerMove}
      onPointerUp={onSvgPointerUp}
      onPointerLeave={() => {
        if (!dragEdit) setHoveredId(null);
      }}
    >
      <g transform={`translate(0 ${axisOffset})`}>
        <g
          transform={`translate(${-view.scrollX} ${-view.scrollY}) scale(${scaleX} ${scaleY})`}
        >
          {diagram.annotations.map((ann) => renderOne(ann))}
          {creationDraft ? (
            <g className={styles.draft}>{renderDraft(creationDraft, diagram.signals, contentHeight)}</g>
          ) : null}
        </g>
      </g>
    </svg>
  );
}
