import { useMemo } from 'react';
import { useStore } from '../shared/store';
import type { DiagramState, ViewState } from '../shared/types';
import { TIME_AXIS_HEIGHT } from '../shared/constants';
import { canvasCellWidth } from './coordinates';
import { buildEdgePathD, labelPositionOnPath, resolveNodeAnchor } from './edgeLayout';
import { buildRowLayout } from './rowLayout';
import { measureHeadFoot } from './renderHeadFoot';
import styles from './EdgeToolOverlay.module.css';

const PREVIEW_ARROW_ID = 'wd-edge-preview-arrowhead';

function waveformTop(view: ViewState, diagram: DiagramState): number {
  const axis = view.showTimeAxis ? TIME_AXIS_HEIGHT : 0;
  const { headHeight } = measureHeadFoot(diagram.config);
  return axis + headHeight;
}

export function EdgeToolOverlay() {
  const tool = useStore((s) => s.view.selectedTool);
  const pending = useStore((s) => s.view.edgeAnchorPending);
  const hover = useStore((s) => s.view.edgeToolHover);
  const timespanLabel = useStore((s) => s.view.activeTimespanLabel);
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);

  const layout = useMemo(() => {
    if (tool !== 'arrow' && tool !== 'timespan') return null;

    const rows = buildRowLayout(diagram.signals);
    const cellW = canvasCellWidth(diagram.config.hscale, view.zoom);
    const topBase = waveformTop(view, diagram);

    const rowBand = (
      signalId: string,
      lo: number,
      hi: number,
      variant: 'valid' | 'invalid' | 'hover',
    ) => {
      const row = rows.find((r) => r.id === signalId);
      if (!row || row.type === 'group') return null;
      const left = lo * cellW - view.scrollX;
      const width = (hi - lo + 1) * cellW;
      const bandTop = row.y * view.zoom - view.scrollY + topBase;
      const height = row.height * view.zoom;
      return { left, width, top: bandTop, height, variant };
    };

    const anchorMarker = (signalId: string, step: number, char: string) => {
      const row = rows.find((r) => r.id === signalId);
      if (!row || row.type === 'group') return null;
      const left = step * cellW - view.scrollX + cellW / 2;
      const bandTop = row.y * view.zoom - view.scrollY + topBase;
      const cy = bandTop + (row.height * view.zoom) / 2;
      return { left, top: cy, char };
    };

    let previewPath: string | null = null;
    let previewLabel: { x: number; y: number; text: string } | null = null;
    let hoverCol: { left: number; top: number; height: number } | null = null;
    let band: ReturnType<typeof rowBand> = null;
    let markers: Array<{ left: number; top: number; char: string }> = [];

    if (hover?.signalId != null && hover.step != null) {
      const row = rows.find((r) => r.id === hover.signalId);
      if (row && row.type !== 'group') {
        const colLeft = hover.step * cellW - view.scrollX;
        const bandTop = row.y * view.zoom - view.scrollY + topBase;
        hoverCol = {
          left: colLeft,
          top: bandTop,
          height: row.height * view.zoom,
        };
      }
    }

    if (pending?.kind === 'arrow') {
      markers.push(
        anchorMarker(pending.signalId, pending.step, pending.char)!,
      );
      if (hover?.signalId && hover.step !== null) {
        const from = resolveNodeAnchor(
          diagram,
          view,
          pending.signalId,
          pending.step,
        );
        const to = resolveNodeAnchor(diagram, view, hover.signalId, hover.step);
        if (from && to) {
          previewPath = buildEdgePathD(from, to, '-');
        }
      }
    }

    if (pending?.kind === 'timespan') {
      markers.push(
        anchorMarker(pending.signalId, pending.startStep, pending.fromChar)!,
      );
      if (hover?.signalId != null && hover.step != null) {
        const sameRow = hover.signalId === pending.signalId;
        const lo = Math.min(pending.startStep, hover.step);
        const hi = Math.max(pending.startStep, hover.step);
        if (sameRow) {
          band = rowBand(
            pending.signalId,
            lo,
            hi,
            lo !== hi ? 'valid' : 'hover',
          );
        } else {
          band = rowBand(hover.signalId, hover.step, hover.step, 'invalid');
        }

        if (sameRow && lo !== hi) {
          const from = resolveNodeAnchor(diagram, view, pending.signalId, lo);
          const to = resolveNodeAnchor(diagram, view, pending.signalId, hi);
          if (from && to) {
            previewPath = buildEdgePathD(from, to, '+');
            const labelPos = labelPositionOnPath(from, to, '+');
            const trimmed = timespanLabel.trim();
            previewLabel = {
              x: labelPos.x,
              y: labelPos.y - 4,
              text: trimmed || '…',
            };
          }
        }
      } else {
        band = rowBand(
          pending.signalId,
          pending.startStep,
          pending.startStep,
          'hover',
        );
      }
    }

    markers = markers.filter(
      (m): m is { left: number; top: number; char: string } => m != null,
    );

    return { hoverCol, markers, previewPath, previewLabel, band };
  }, [tool, pending, hover, timespanLabel, diagram, view]);

  if (!layout) return null;

  const { hoverCol, markers, previewPath, previewLabel, band } = layout;
  const showSvg = previewPath != null;

  if (!hoverCol && markers.length === 0 && !band && !showSvg) return null;

  return (
    <>
      {hoverCol ? (
        <div
          className={styles.hoverCol}
          style={{
            left: hoverCol.left,
            top: hoverCol.top,
            width: canvasCellWidth(diagram.config.hscale, view.zoom),
            height: hoverCol.height,
          }}
          aria-hidden
        />
      ) : null}
      {band ? (
        <div
          className={
            band.variant === 'valid'
              ? styles.timespanBandValid
              : band.variant === 'invalid'
                ? styles.timespanBandInvalid
                : styles.timespanBandHover
          }
          style={{
            left: band.left,
            top: band.top,
            width: band.width,
            height: band.height,
          }}
          aria-hidden
        />
      ) : null}
      {markers.map((m, i) => (
        <div
          key={`anchor-${i}`}
          className={styles.anchorMarker}
          style={{ left: m.left, top: m.top }}
          aria-hidden
        >
          <span className={styles.anchorChar}>{m.char}</span>
        </div>
      ))}
      {showSvg ? (
        <svg className={styles.edgeToolSvg} aria-hidden>
          <defs>
            <marker
              id={PREVIEW_ARROW_ID}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L8,4 L0,8 z" fill="var(--edge-preview-stroke, #7eb8ff)" />
            </marker>
          </defs>
          <path
            className={styles.previewPath}
            d={previewPath!}
            markerEnd={
              tool === 'arrow' ? `url(#${PREVIEW_ARROW_ID})` : undefined
            }
          />
          {previewLabel ? (
            <text
              className={styles.previewLabel}
              x={previewLabel.x}
              y={previewLabel.y}
              textAnchor="middle"
            >
              {previewLabel.text}
            </text>
          ) : null}
        </svg>
      ) : null}
    </>
  );
}
