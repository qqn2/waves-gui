import { useMemo } from 'react';
import { useStore } from '../shared/store';
import {
  buildEdgePathD,
  buildNodeIndex,
  labelPositionOnPath,
  parseEdge,
  resolveEdgeAnchors,
} from './edgeLayout';
import { EDGE_ARROW_PATH, edgeArrowMarkerProps } from './edgeArrowMarker';
import styles from './EdgeOverlay.module.css';

const ARROW_ID = 'wd-edge-arrowhead';

export function EdgeOverlay() {
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);

  const shapes = useMemo(() => {
    const nodeIndex = buildNodeIndex(diagram.signals);
    const items: Array<{
      key: string;
      d: string;
      hasArrow: boolean;
      label: string;
      labelX: number;
      labelY: number;
    }> = [];

    (diagram.edges ?? []).forEach((edgeStr, i) => {
      const parsed = parseEdge(edgeStr);
      if (!parsed) return;
      const anchors = resolveEdgeAnchors(diagram, view, parsed, nodeIndex);
      if (!anchors) return;
      const d = buildEdgePathD(anchors.from, anchors.to, parsed.shape);
      const labelPos = labelPositionOnPath(
        anchors.from,
        anchors.to,
        parsed.shape,
      );
      items.push({
        key: `edge-${i}`,
        d,
        hasArrow: parsed.hasArrow,
        label: parsed.label,
        labelX: labelPos.x,
        labelY: labelPos.y - 4,
      });
    });

    return items;
  }, [diagram, view]);

  if (shapes.length === 0) return null;

  return (
    <svg className={styles.edgeOverlay} aria-hidden>
      <defs>
        <marker id={ARROW_ID} {...edgeArrowMarkerProps}>
          <path d={EDGE_ARROW_PATH} fill="var(--edge-stroke, #d4a84b)" />
        </marker>
      </defs>
      {shapes.map((s) => (
        <g key={s.key}>
          <path
            className={styles.edgePath}
            d={s.d}
            markerEnd={s.hasArrow ? `url(#${ARROW_ID})` : undefined}
          />
          {s.label ? (
            <text
              className={styles.edgeLabel}
              x={s.labelX}
              y={s.labelY}
              textAnchor="middle"
            >
              {s.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
