import { useMemo } from 'react';
import { useStore } from '../shared/store';
import {
  buildEdgePathD,
  buildNodeIndex,
  cubicMidpoint,
  defaultCurveControl,
  isCurvyEdgeShape,
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
  const tool = useStore((s) => s.view.selectedTool);
  const showHandles = tool === 'cursor' || tool === 'select';

  const shapes = useMemo(() => {
    const nodeIndex = buildNodeIndex(
      diagram.signals,
      diagram.compatibility?.extensionsEnabled === true,
    );
    const controls = diagram.edgeCurveControls ?? {};
    const items: Array<{
      key: string;
      index: number;
      d: string;
      hasStartArrow: boolean;
      hasArrow: boolean;
      startMarker?: 'square' | 'circle';
      endMarker?: 'square' | 'circle';
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      label: string;
      labelX: number;
      labelY: number;
      handleX?: number;
      handleY?: number;
    }> = [];

    (diagram.edges ?? []).forEach((edgeStr, i) => {
      const parsed = parseEdge(edgeStr);
      if (!parsed) return;
      if (
        diagram.compatibility?.extensionsEnabled !== true
        && (parsed.startMarker || parsed.endMarker)
      ) return;
      const anchors = resolveEdgeAnchors(diagram, view, parsed, nodeIndex);
      if (!anchors) return;
      const curve = isCurvyEdgeShape(parsed.shape)
        ? (controls[i] ?? defaultCurveControl(parsed.shape))
        : undefined;
      const d = buildEdgePathD(anchors.from, anchors.to, parsed.shape, curve);
      const labelPos = labelPositionOnPath(
        anchors.from,
        anchors.to,
        parsed.shape,
      );
      let handleX: number | undefined;
      let handleY: number | undefined;
      if (curve && isCurvyEdgeShape(parsed.shape)) {
        const dx = anchors.to.x - anchors.from.x;
        const dy = anchors.to.y - anchors.from.y;
        const mid = cubicMidpoint(
          anchors.from,
          anchors.to,
          anchors.from.x + curve.c1x * dx,
          anchors.from.y,
          anchors.from.x + curve.c2x * dx,
          anchors.from.y + dy,
        );
        handleX = mid.x;
        handleY = mid.y;
      }
      items.push({
        key: `edge-${i}`,
        index: i,
        d,
        hasStartArrow: parsed.hasStartArrow,
        hasArrow: parsed.hasArrow,
        ...(parsed.startMarker ? { startMarker: parsed.startMarker } : {}),
        ...(parsed.endMarker ? { endMarker: parsed.endMarker } : {}),
        fromX: anchors.from.x,
        fromY: anchors.from.y,
        toX: anchors.to.x,
        toY: anchors.to.y,
        label: parsed.label,
        labelX: labelPos.x,
        labelY: labelPos.y - 4,
        handleX,
        handleY,
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
            markerStart={s.hasStartArrow ? `url(#${ARROW_ID})` : undefined}
            markerEnd={s.hasArrow ? `url(#${ARROW_ID})` : undefined}
          />
          {s.startMarker === 'square' ? (
            <rect
              className={styles.edgeEndpointMarker}
              x={s.fromX - 4}
              y={s.fromY - 4}
              width={8}
              height={8}
            />
          ) : s.startMarker === 'circle' ? (
            <circle
              className={styles.edgeEndpointMarker}
              cx={s.fromX}
              cy={s.fromY}
              r={4}
            />
          ) : null}
          {s.endMarker === 'square' ? (
            <rect
              className={styles.edgeEndpointMarker}
              x={s.toX - 4}
              y={s.toY - 4}
              width={8}
              height={8}
            />
          ) : s.endMarker === 'circle' ? (
            <circle
              className={styles.edgeEndpointMarker}
              cx={s.toX}
              cy={s.toY}
              r={4}
            />
          ) : null}
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
          {showHandles && s.handleX !== undefined && s.handleY !== undefined ? (
            <circle
              className={styles.edgeCurveHandle}
              cx={s.handleX}
              cy={s.handleY}
              r={5}
              data-edge-index={s.index}
            />
          ) : null}
        </g>
      ))}
    </svg>
  );
}
