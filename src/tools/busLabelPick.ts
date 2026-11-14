import {
  colorIndexFromFillHex,
  type WavedromColorIndex,
} from '../wavedromBridge/wavedromColors';
import { useStore } from '../shared/store';
import { findSignal } from '../shared/store/helpers';
import type { DiagramState, VectorSegment, ViewState } from '../shared/types';
import { segmentAtStep } from '../shared/vectorSegments';
import type { HitTestResult } from '../renderer/hitTest';
import { hasOpaqueMixedWave } from '../shared/mixedWave';

export function selectedBusSegment(diagram: DiagramState, view: ViewState): {
  signalId: string; segment: VectorSegment;
} | null {
  const target = view.activeBusSegment;
  if (!target || view.activeSignalIds.length !== 1
    || view.activeSignalIds[0] !== target.signalId
    || (view.selectedTool !== 'cursor' && view.selectedTool !== 'select')) return null;
  let result: { signalId: string; segment: VectorSegment } | null = null;
  findSignal(diagram.signals, target.signalId, (signal) => {
    if (signal.type !== 'vector' || hasOpaqueMixedWave(signal)) return;
    const segment = signal.segments.find(({ id }) => id === target.segmentId);
    if (segment) result = { signalId: signal.id, segment };
  });
  return result;
}

/** Copy a bus segment label (and color) at the hit step into the paint toolbar. */
export function pickBusLabelFromHit(hit: HitTestResult, diagram: DiagramState): boolean {
  useStore.setState((state) => { state.view.activeBusSegment = null; });
  if (hit.signalType !== 'vector' || hit.signalId === null || hit.step === null) {
    return false;
  }
  let pickedLabel: string | null = null;
  let pickedColorIndex: WavedromColorIndex | null = null;
  findSignal(diagram.signals, hit.signalId, (sig) => {
    if (sig.type !== 'vector') return;
    const seg = segmentAtStep(sig.segments, hit.step!);
    if (!seg) return;
    pickedLabel = seg.value;
    useStore.setState((state) => {
      state.view.activeBusSegment = { signalId: sig.id, segmentId: seg.id };
    });
    if (seg.color !== undefined) {
      pickedColorIndex = colorIndexFromFillHex(seg.color) as WavedromColorIndex;
    }
  });
  if (pickedLabel === null) return false;
  useStore.getState().setActiveBusLabel(pickedLabel);
  if (pickedColorIndex !== null) {
    useStore.getState().setActiveBusColorIndex(pickedColorIndex);
  }
  return true;
}
