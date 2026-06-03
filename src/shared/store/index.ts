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
import { defaultDiagram, defaultView } from './helpers';
import { loadThemeSettings } from '../theme';
import { createSignalActions } from './signalActions';
import { createEdgeActions, createDocumentActions } from './documentActions';
import { createViewActions } from './viewActions';

export type { StoreActions, Actions } from './storeActions';
export {
  clearStepGlitchesTouchingRange,
  findSignal,
  findGroup,
  pushHistory,
} from './helpers';

export const useStore = create<AppState & StoreActions>()(
  immer((set) => {
    const storedTheme = loadThemeSettings();
    return {
      diagram: defaultDiagram(),
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
      ...createViewActions(set),
    };
  }),
);
