import { useCallback, useState } from 'react';
import type { TextAnnotation } from '../shared/types';
import type { SignalOrGroup } from '../shared/types';
import { getSignalRowY, stepCenterX } from './annotationGeometry';

export interface TextAnnotationElProps {
  annotation: TextAnnotation;
  signals: SignalOrGroup[];
  showHandles: boolean;
  onTextChange?: (text: string) => void;
}

export function TextAnnotationEl({
  annotation,
  signals,
  showHandles,
  onTextChange,
}: TextAnnotationElProps) {
  const x = stepCenterX(annotation.step);
  const y = getSignalRowY(annotation.signalId, signals);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(annotation.text);

  const commit = useCallback(() => {
    setEditing(false);
    if (draft !== annotation.text) onTextChange?.(draft);
  }, [annotation.text, draft, onTextChange]);

  return (
    <g className="ann-text" data-annotation-id={annotation.id}>
      {editing ? (
        <foreignObject x={x - 60} y={y - 14} width={120} height={28}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(annotation.text);
                setEditing(false);
              }
            }}
            autoFocus
            style={{
              width: '100%',
              fontSize: 12,
              color: annotation.color,
              background: 'var(--bg-canvas, #111)',
              border: `1px solid ${annotation.color}`,
              borderRadius: 2,
              padding: '2px 4px',
            }}
          />
        </foreignObject>
      ) : (
        <text
          x={x}
          y={y}
          fill={annotation.color}
          fontSize={12}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ pointerEvents: 'all', cursor: 'text', userSelect: 'none' }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setDraft(annotation.text);
            setEditing(true);
          }}
        >
          {annotation.text}
        </text>
      )}
      {showHandles && !editing ? (
        <circle
          cx={x}
          cy={y}
          r={5}
          className="ann-handle"
          data-handle="position"
          fill="var(--bg-canvas, #111)"
          stroke={annotation.color}
          strokeWidth={2}
        />
      ) : null}
    </g>
  );
}
