import type {
  DiagramState,
  EdgeAnchorPending,
  Tool,
  ViewState,
} from '../shared/types';
import { TIME_AXIS_HEIGHT } from '../shared/constants';
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
  const axis = view.showTimeAxis ? TIME_AXIS_HEIGHT : 0;
  const { headHeight } = measureHeadFoot(diagram.config);
  const waveformTop = axis + headHeight;
  const top = row.y * view.zoom - view.scrollY + waveformTop;
  const height = row.height * view.zoom;

  let signalName = hit.signalId;
  let current: BitState | null = null;
  signalName = targetSignal.name;
  if (targetSignal.type === 'bit') current = targetSignal.states[hit.step];

  const paintHint =
    hit.signalType === 'bit' && current !== null
      ? view.paintMode === 'glitch'
        ? ' · glitch'
        : view.paintMode === 'gap'
          ? ' · |'
          : view.paintMode === 'set'
          ? ` → ${view.activeBitState}`
          : ` ${current}→${toggleBinaryBitState(current)}`
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
      edgeHint = ' · click start';
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
        {edgeHint}
      </div>
    </>
  );
}
