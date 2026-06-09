import {
  colorIndexFromFillHex,
  type WavedromColorIndex,
} from '../wavedromBridge/wavedromColors';
import { useStore } from '../shared/store';
import { findSignal } from '../shared/store/helpers';
import type { DiagramState } from '../shared/types';
import { segmentAtStep } from '../shared/vectorSegments';
import type { HitTestResult } from '../renderer/hitTest';

/** Copy a bus segment label (and color) at the hit step into the paint toolbar. */
export function pickBusLabelFromHit(hit: HitTestResult, diagram: DiagramState): boolean {
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
