import type {
  DiagramState,
  EdgeAnchorPending,
  Tool,
  ViewState,
} from '../shared/types';
import { CELL_WIDTH, ROW_HEIGHT, TIME_AXIS_HEIGHT } from '../shared/constants';
import { buildRowLayout } from './rowLayout';
import { measureHeadFoot } from './renderHeadFoot';
import type { HitTestResult } from './hitTest';
import { findSignal } from '../shared/store';
import { toggleBinaryBitState } from '../shared/bitToggle';
import type { BitState } from '../shared/types';
import { stepLogicalX, stepLogicalXEnd } from './laneTiming';

export interface PointerMarkerProps {
  hit: HitTestResult | null;
  diagram: DiagramState;
  view: ViewState;
  tool?: Tool;
  edgePending?: EdgeAnchorPending | null;
}

export function PointerMarker({
  hit,
  diagram,
  view,
  tool = 'cursor',
  edgePending = null,
}: PointerMarkerProps) {
  if (!hit?.signalId || hit.step === null) return null;

  const rows = buildRowLayout(diagram.signals);
  const row = rows.find((r) => r.id === hit.signalId);
  if (!row || row.type === 'group') return null;

  let targetSignal: import('../shared/types').Signal | null = null;
  findSignal(diagram.signals, hit.signalId, (signal) => {
    targetSignal = signal;
  });
  if (!targetSignal) return null;
  const scale = diagram.config.hscale * view.zoom;
  const left = stepLogicalX(targetSignal, hit.step) * scale - view.scrollX;
  const cellW =
    (stepLogicalXEnd(targetSignal, hit.step) - stepLogicalX(targetSignal, hit.step)) * scale;
  const axis = TIME_AXIS_HEIGHT;
  const { headHeight } = measureHeadFoot(diagram.config);
  const waveformTop = axis + headHeight;
  const top = row.y * view.zoom - view.scrollY + waveformTop;
  const height = row.height * view.zoom;

  if (tool === 'structured-arrow') {
    const hover = view.edgeToolHover;
    const currentX = hover?.canvasX ?? left + cellW / 2;
    const currentY = hover?.canvasY ?? top + height / 2;
    const pending = view.structuredArrowPending;
    const startX = pending
      ? pending.x * CELL_WIDTH * scale - view.scrollX
      : null;
    const startY = pending
      ? waveformTop + pending.y * ROW_HEIGHT * view.zoom - view.scrollY
      : null;
    return (
      <>
        {startX !== null && startY !== null && (
          <>
            <svg className="structuredArrowPreview" aria-hidden>
              <line x1={startX} y1={startY} x2={currentX} y2={currentY} />
            </svg>
            <div
              className="structuredArrowStart"
              style={{ left: startX, top: startY }}
              aria-hidden
            />
          </>
        )}
        <div
          className="structuredArrowCursor"
          style={{ left: currentX, top: currentY }}
          aria-hidden
        />
        <div
          className="pointerMarkerLabel"
          style={{ left: currentX + 10, top: currentY + 8 }}
        >
          {pending ? 'Click arrow end · Esc cancels' : 'Click arrow start'}
        </div>
      </>
    );
  }

  let signalName = hit.signalId;
  let current: BitState | null = null;
  signalName = targetSignal.name;
  if (targetSignal.type === 'bit') current = targetSignal.states[hit.step];

  const paintHint =
    tool === 'paint' && hit.signalType === 'bit' && current !== null
      ? view.paintMode === 'glitch'
        ? ' · glitch'
        : view.paintMode === 'gap'
          ? ' · |'
          : view.paintMode === 'set'
          ? ` → ${view.activeBitState}`
          : ` ${current}→${toggleBinaryBitState(current)}`
      : '';
  const analoguePaintHint =
    tool === 'analogue-paint' && hit.signalType === 'analogue'
      ? ` · ${view.activeAnalogueKind} → ${view.activeAnalogueValue}`
      : '';

  let edgeHint = '';
  if (tool === 'arrow') {
    if (edgePending?.kind === 'arrow') {
      const same =
        hit.signalId === edgePending.signalId && hit.step === edgePending.step;
      edgeHint = same
        ? ` · anchor ${edgePending.char}`
        : hit.step !== null
          ? ` · → T${hit.step}`
          : '';
    } else {
      edgeHint = ' · press and drag';
    }
  } else if (tool === 'timespan') {
    if (edgePending?.kind === 'timespan') {
      const sameRow = hit.signalId === edgePending.signalId;
      edgeHint = sameRow
        ? ` · T${edgePending.startStep}→T${hit.step}`
        : ' · wrong row';
    } else {
      edgeHint = ' · press start';
    }
  }

  return (
    <>
      <div
        className="pointerMarkerCol"
        style={{ left, width: cellW, top: waveformTop }}
        aria-hidden
      />
      <div
        className="pointerMarkerRow"
        style={{ top, height, left: 0, right: 0 }}
        aria-hidden
      />
      <div className="pointerMarkerLabel" style={{ left: left + 4, top: top + 2 }}>
        t{hit.step} · {signalName}
        {paintHint}
        {analoguePaintHint}
        {edgeHint}
      </div>
    </>
  );
}
