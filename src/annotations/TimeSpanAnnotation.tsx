import type { TimeSpanAnnotation as SpanAnn } from '../shared/types';
import { stepLeftX } from './annotationGeometry';

const HANDLE_R = 5;
const BRACKET_OFFSET = 16;

export interface TimeSpanAnnotationProps {
  annotation: SpanAnn;
  contentHeight: number;
  showHandles: boolean;
}

export function TimeSpanAnnotationEl({
  annotation,
  contentHeight,
  showHandles,
}: TimeSpanAnnotationProps) {
  const x1 = stepLeftX(annotation.startStep);
  const x2 = stepLeftX(annotation.endStep + 1);
  const y =
    annotation.row === 'bottom'
      ? contentHeight + BRACKET_OFFSET
      : -BRACKET_OFFSET;
  const midX = (x1 + x2) / 2;

  return (
    <g className="ann-timespan" data-annotation-id={annotation.id}>
      <line x1={x1} y1={y} x2={x1} y2={y + 8} stroke={annotation.color} strokeWidth={2} />
      <line x1={x2} y1={y} x2={x2} y2={y + 8} stroke={annotation.color} strokeWidth={2} />
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={annotation.color} strokeWidth={2} />
      {annotation.label ? (
        <text
          x={midX}
          y={y - 6}
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
            cx={x1}
            cy={y}
            r={HANDLE_R}
            className="ann-handle"
            data-handle="start"
            fill="var(--bg-canvas, #111)"
            stroke={annotation.color}
            strokeWidth={2}
          />
          <circle
            cx={x2}
            cy={y}
            r={HANDLE_R}
            className="ann-handle"
            data-handle="end"
            fill="var(--bg-canvas, #111)"
            stroke={annotation.color}
            strokeWidth={2}
          />
        </>
      ) : null}
    </g>
  );
}
