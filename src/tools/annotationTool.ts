import type { HitTestResult } from '../renderer/hitTest';
import { useStore } from '../shared/store';

export function annotationPointerDown(
  event: PointerEvent,
  hit: HitTestResult,
): void {
  if (event.button !== 0 || hit.step === null || !hit.signalId) return;
  if (hit.signalType !== 'bit' && hit.signalType !== 'vector') return;
  const { addTextAnnotation, setActiveAnnotationId } = useStore.getState();
  const id = addTextAnnotation({
    text: 'Annotation',
    tick: hit.step,
    signalId: hit.signalId,
  });
  if (id) setActiveAnnotationId(id);
}

export function verticalLinePointerDown(
  event: PointerEvent,
  hit: HitTestResult,
): void {
  if (event.button !== 0 || hit.step === null) return;
  const { addVerticalLineAnnotation, setActiveAnnotationId } = useStore.getState();
  const id = addVerticalLineAnnotation({ tick: hit.step });
  if (id) setActiveAnnotationId(id);
}

export function horizontalLinePointerDown(
  event: PointerEvent,
  hit: HitTestResult,
): void {
  if (event.button !== 0 || !hit.signalId || hit.signalType === 'group') return;
  const { addHorizontalLineAnnotation, setActiveAnnotationId } = useStore.getState();
  const id = addHorizontalLineAnnotation({
    signalId: hit.signalId,
    yOffset: 0,
  });
  if (id) setActiveAnnotationId(id);
}
