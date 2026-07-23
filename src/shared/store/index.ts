/**
 * Global app state (Zustand + Immer).
 *
 * Split by domain:
 *   helpers.ts        — tree walks, undo snapshot, defaults
 *   signalActions.ts  — signals, paint state, steps/hscale
 *   documentActions.ts — load/save/undo + WaveDrom edge[]
 *   viewActions.ts    — zoom, scroll, tools, theme
 *
 * See README.md for data-flow overview.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { AppState } from '../types';
import type { StoreActions } from './storeActions';
import { defaultDiagram, defaultView, isDocumentDirty } from './helpers';
import { normalizeDiagram } from '../normalizeDiagram';
import { loadThemeSettings } from '../theme';
import { createSignalActions } from './signalActions';
import { createEdgeActions, createDocumentActions } from './documentActions';
import { createViewActions } from './viewActions';
import { createAnnotationActions } from './annotationActions';

export type { StoreActions, Actions } from './storeActions';
export {
  clearStepGlitchesTouchingRange,
  findSignal,
  findGroup,
  diagramsEqual,
  isDocumentDirty,
  pushHistory,
} from './helpers';

export const useStore = create<AppState & StoreActions>()(
  immer((set) => {
    const storedTheme = loadThemeSettings();
    const diagram = defaultDiagram();
    return {
      diagram,
      savedDiagram: normalizeDiagram(diagram),
      view: {
        ...defaultView(),
        theme: storedTheme.theme,
        accentColor: storedTheme.accentColor,
        canvasColor: storedTheme.canvasColor,
        uiFontScale: storedTheme.uiFontScale,
      },
      history: [],
      future: [],

      ...createSignalActions(set),
      ...createEdgeActions(set),
      ...createDocumentActions(set),
      ...createAnnotationActions(set),
      ...createViewActions(set),
    };
  }),
);

// Reconcile the compatibility cache after every document/savepoint mutation.
// Subscriptions run synchronously, so consumers never observe stale dirtiness.
useStore.subscribe((state, previous) => {
  if (
    state.diagram === previous.diagram
    && state.savedDiagram === previous.savedDiagram
  ) return;
  const isDirty = isDocumentDirty(state);
  if (state.view.isDirty === isDirty) return;
  useStore.setState((draft) => {
    draft.view.isDirty = isDirty;
  });
});
