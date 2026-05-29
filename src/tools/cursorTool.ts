import type { Annotation } from '../shared/types';
import { useStore } from '../shared/store';
import { flushPendingCodeToDiagram } from './codeFlush';
import { setActiveSignalIds, toolState } from './toolState';
import type { HitTestResult } from './hitTestStub';

function signalIdsForAnnotation(ann: Annotation): string[] {
  switch (ann.type) {
    case 'arrow':
      return [ann.fromSignalId, ann.toSignalId];
    case 'text':
      return [ann.signalId];
    default:
      return [];
  }
}

export function cursorPointerDown(hit: HitTestResult): void {
  flushPendingCodeToDiagram();

  if (hit.annotationId) {
    const ann = useStore
      .getState()
      .diagram.annotations.find((a) => a.id === hit.annotationId);
    toolState.setSelectedAnnotationId(hit.annotationId);
    if (ann) {
      setActiveSignalIds(signalIdsForAnnotation(ann));
    }
    return;
  }

  toolState.setSelectedAnnotationId(null);
  if (hit.signalId && hit.signalType !== 'group') {
    setActiveSignalIds([hit.signalId]);
  } else {
    setActiveSignalIds([]);
  }
}

export function clearCursorSelection(): void {
  toolState.setSelectedAnnotationId(null);
  setActiveSignalIds([]);
}
