import type { ArrowAnnotation as ArrowAnn } from '../shared/types';
import type { SignalOrGroup } from '../shared/types';
import { EDGE_ARROW_PATH, edgeArrowMarkerProps } from '../renderer/edgeArrowMarker';
import { getSignalRowY, stepCenterX } from './annotationGeometry';

const HANDLE_R = 5;

export interface ArrowAnnotationProps {
  annotation: ArrowAnn;
  signals: SignalOrGroup[];
  showHandles: boolean;
}

export function ArrowAnnotationEl({ annotation, signals, showHandles }: ArrowAnnotationProps) {
  const fromX = stepCenterX(annotation.fromStep);
  const toX = stepCenterX(annotation.toStep);
  const fromY = getSignalRowY(annotation.fromSignalId, signals);
  const toY = getSignalRowY(annotation.toSignalId, signals);
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;

  return (
    <g className="ann-arrow" data-annotation-id={annotation.id}>
      <defs>
        <marker id={`arrowhead-${annotation.id}`} {...edgeArrowMarkerProps}>
          <path d={EDGE_ARROW_PATH} fill={annotation.color} />
        </marker>
      </defs>
      <line
        x1={fromX}
        y1={fromY}
        x2={toX}
        y2={toY}
        stroke={annotation.color}
        strokeWidth={2}
        markerEnd={`url(#arrowhead-${annotation.id})`}
        style={{ pointerEvents: 'stroke' }}
      />
      {annotation.label ? (
        <text
          x={midX}
          y={midY - 8}
          fill={annotation.color}
          fontSize={12}
          textAnchor="middle"
          dominantBaseline="auto"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {annotation.label}
        </text>
      ) : null}
      {showHandles ? (
        <>
          <circle
            cx={fromX}
            cy={fromY}
            r={HANDLE_R}
            className="ann-handle"
            data-handle="from"
            fill="var(--bg-canvas, #111)"
            stroke={annotation.color}
            strokeWidth={2}
          />
          <circle
            cx={toX}
            cy={toY}
            r={HANDLE_R}
            className="ann-handle"
            data-handle="to"
            fill="var(--bg-canvas, #111)"
            stroke={annotation.color}
            strokeWidth={2}
          />
        </>
      ) : null}
    </g>
  );
}
