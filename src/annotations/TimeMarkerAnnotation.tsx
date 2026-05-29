import type { TimeMarkerAnnotation as MarkerAnn } from '../shared/types';
import { stepLeftX } from './annotationGeometry';

const HANDLE_R = 5;

export interface TimeMarkerAnnotationProps {
  annotation: MarkerAnn;
  contentHeight: number;
  showHandles: boolean;
}

export function TimeMarkerAnnotationEl({
  annotation,
  contentHeight,
  showHandles,
}: TimeMarkerAnnotationProps) {
  const x = stepLeftX(annotation.step);

  return (
    <g className="ann-marker" data-annotation-id={annotation.id}>
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={contentHeight}
        stroke={annotation.color}
        strokeWidth={1.5}
        strokeDasharray="4 3"
        style={{ pointerEvents: 'stroke' }}
      />
      {annotation.label ? (
        <text
          x={x + 4}
          y={12}
          fill={annotation.color}
          fontSize={11}
          dominantBaseline="hanging"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {annotation.label}
        </text>
      ) : null}
      {showHandles ? (
        <circle
          cx={x}
          cy={14}
          r={HANDLE_R}
          className="ann-handle"
          data-handle="step"
          fill="var(--bg-canvas, #111)"
          stroke={annotation.color}
          strokeWidth={2}
        />
      ) : null}
    </g>
  );
}
