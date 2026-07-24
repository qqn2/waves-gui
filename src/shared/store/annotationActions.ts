import { nanoid } from 'nanoid';
import {
  MAX_ANNOTATIONS,
  normalizeHorizontalLineAnnotation,
  normalizeTextAnnotation,
  normalizeVerticalLineAnnotation,
} from '../annotations';
import type {
  HorizontalLineAnnotation,
  TextAnnotation,
  VerticalLineAnnotation,
} from '../types';
import type { ImmerSet, StoreActions } from './storeActions';
import { pushHistory } from './helpers';

export function createAnnotationActions(set: ImmerSet): Pick<
  StoreActions,
  | 'addTextAnnotation'
  | 'addVerticalLineAnnotation'
  | 'addHorizontalLineAnnotation'
  | 'updateTextAnnotation'
  | 'updateVerticalLineAnnotation'
  | 'updateHorizontalLineAnnotation'
  | 'removeAnnotation'
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

    addVerticalLineAnnotation(annotation) {
      const id = nanoid();
      let added = false;
      set((state) => {
        if (state.diagram.compatibility?.extensionsEnabled !== true) return;
        const annotations = state.diagram.annotations ?? [];
        if (annotations.length >= MAX_ANNOTATIONS) return;
        pushHistory(state);
        state.diagram.annotations = annotations;
        state.diagram.annotations.push(
          normalizeVerticalLineAnnotation(
            { ...annotation, id, type: 'vertical-line' },
            state.diagram.config.totalSteps,
          ),
        );
        added = true;
      });
      return added ? id : null;
    },

    addHorizontalLineAnnotation(annotation) {
      const id = nanoid();
      let added = false;
      set((state) => {
        if (state.diagram.compatibility?.extensionsEnabled !== true) return;
        const annotations = state.diagram.annotations ?? [];
        if (annotations.length >= MAX_ANNOTATIONS) return;
        pushHistory(state);
        state.diagram.annotations = annotations;
        state.diagram.annotations.push(
          normalizeHorizontalLineAnnotation(
            { ...annotation, id, type: 'horizontal-line' },
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

    updateVerticalLineAnnotation(id, patch) {
      set((state) => {
        if (state.diagram.compatibility?.extensionsEnabled !== true) return;
        const annotation = state.diagram.annotations?.find(
          (item): item is VerticalLineAnnotation =>
            item.id === id && item.type === 'vertical-line',
        );
        if (!annotation) return;
        const normalized = normalizeVerticalLineAnnotation(
          { ...annotation, ...patch, id, type: 'vertical-line' },
          state.diagram.config.totalSteps,
        );
        if (JSON.stringify(annotation) === JSON.stringify(normalized)) return;
        pushHistory(state);
        Object.assign(annotation, normalized);
      });
    },

    updateHorizontalLineAnnotation(id, patch) {
      set((state) => {
        if (state.diagram.compatibility?.extensionsEnabled !== true) return;
        const annotation = state.diagram.annotations?.find(
          (item): item is HorizontalLineAnnotation =>
            item.id === id && item.type === 'horizontal-line',
        );
        if (!annotation) return;
        const normalized = normalizeHorizontalLineAnnotation(
          { ...annotation, ...patch, id, type: 'horizontal-line' },
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
