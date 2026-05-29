import type { DiagramState, ViewState } from '../shared/types';
import { TIME_AXIS_HEIGHT } from '../shared/constants';
import { buildRowLayout } from './rowLayout';
import { measureHeadFoot } from './renderHeadFoot';
import { canvasCellWidth } from './coordinates';
import type { HitTestResult } from './hitTest';
import { findSignal } from '../shared/store';
import { toggleBinaryBitState } from '../shared/bitToggle';
import type { BitState } from '../shared/types';

export interface PointerMarkerProps {
  hit: HitTestResult | null;
  diagram: DiagramState;
  view: ViewState;
}

export function PointerMarker({ hit, diagram, view }: PointerMarkerProps) {
  if (!hit?.signalId || hit.step === null) return null;

  const rows = buildRowLayout(diagram.signals);
  const row = rows.find((r) => r.id === hit.signalId);
  if (!row || row.type === 'group') return null;

  const cellW = canvasCellWidth(diagram.config.hscale, view.zoom);
  const axis = view.showTimeAxis ? TIME_AXIS_HEIGHT : 0;
  const { headHeight } = measureHeadFoot(diagram.config);
  const waveformTop = axis + headHeight;
  const left = hit.step * cellW - view.scrollX;
  const top = row.y * view.zoom - view.scrollY + waveformTop;
  const height = row.height * view.zoom;

  let signalName = hit.signalId;
  let current: BitState | null = null;
  findSignal(diagram.signals, hit.signalId, (s) => {
    signalName = s.name;
    if (s.type === 'bit' && hit.step !== null) current = s.states[hit.step];
  });

  const paintHint =
    hit.signalType === 'bit' && current !== null
      ? view.paintMode === 'set'
        ? ` → ${view.activeBitState}`
        : ` ${current}→${toggleBinaryBitState(current)}`
      : '';

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
      </div>
    </>
  );
}
