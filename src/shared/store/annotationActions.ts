import { nanoid } from 'nanoid';
import {
  MAX_ANNOTATIONS,
  normalizeTextAnnotation,
} from '../annotations';
import type { TextAnnotation } from '../types';
import type { ImmerSet, StoreActions } from './storeActions';
import { pushHistory } from './helpers';

export function createAnnotationActions(set: ImmerSet): Pick<
  StoreActions,
  'addTextAnnotation' | 'updateTextAnnotation' | 'removeAnnotation'
> {
  return {
    addTextAnnotation(annotation) {
      const id = nanoid();
      let added = false;
      set((state) => {
        if (state.diagram.compatibility?.extensionsEnabled !== true) return;
        const annotations = state.diagram.annotations ?? [];
        if (annotations.length >= MAX_ANNOTATIONS) return;
        pushHistory(state);
        state.diagram.annotations = annotations;
        state.diagram.annotations.push(
          normalizeTextAnnotation(
            { ...annotation, id, type: 'text' },
            state.diagram.config.totalSteps,
          ),
        );
        added = true;
      });
      return added ? id : null;
    },

    updateTextAnnotation(id, patch) {
      set((state) => {
        if (state.diagram.compatibility?.extensionsEnabled !== true) return;
        const annotation = state.diagram.annotations?.find(
          (item): item is TextAnnotation => item.id === id && item.type === 'text',
        );
        if (!annotation) return;
        const normalized = normalizeTextAnnotation(
          { ...annotation, ...patch, id, type: 'text' },
          state.diagram.config.totalSteps,
        );
        if (JSON.stringify(annotation) === JSON.stringify(normalized)) return;
        pushHistory(state);
        Object.assign(annotation, normalized);
      });
    },

    removeAnnotation(id) {
      set((state) => {
        if (state.diagram.compatibility?.extensionsEnabled !== true) return;
        const index = state.diagram.annotations?.findIndex(
          (annotation) => annotation.id === id,
        ) ?? -1;
        if (index < 0) return;
        pushHistory(state);
        state.diagram.annotations!.splice(index, 1);
      });
    },
  };
}
