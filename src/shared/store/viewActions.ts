import type { BitState, PaintMode, Theme, Tool } from '../types';
import type { WavedromColorIndex } from '../../wavedromBridge/wavedromColors';
import { MIN_ZOOM, MAX_ZOOM } from '../constants';
import { saveThemeSettings, themeSettingsFromView } from '../theme';
import {
  clampLabelColumnWidth,
  saveLabelColumnWidth,
} from '../../shell/labelColumnLayout';
import type { ImmerSet, StoreActions } from './storeActions';

function persistTheme(view: {
  theme: Theme;
  accentColor: string | null;
  canvasColor: string | null;
  uiFontScale: number;
}): void {
  saveThemeSettings(themeSettingsFromView(view));
}

export function createViewActions(set: ImmerSet): Pick<
  StoreActions,
  | 'setZoom'
  | 'setScroll'
  | 'setTool'
  | 'setActiveBitState'
  | 'setActiveBusLabel'
  | 'setActiveTimespanLabel'
  | 'setActiveBusColorIndex'
  | 'setEdgeToolHover'
  | 'setPaintMode'
  | 'toggleCodePanel'
  | 'toggleRenderPanel'
  | 'setLabelWidth'
  | 'toggleTimeAxis'
  | 'setTheme'
  | 'setAccentColor'
  | 'setCanvasColor'
  | 'setUiFontScale'
> {
  return {
    setZoom(zoom) {
      set((s) => {
        s.view.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
      });
    },

    setScroll(x, y) {
      set((s) => {
        s.view.scrollX = Math.max(0, x);
        s.view.scrollY = Math.max(0, y);
      });
    },

    setTool(tool: Tool) {
      set((s) => {
        s.view.selectedTool = tool;
      });
    },

    setActiveBitState(state: BitState) {
      set((s) => {
        s.view.activeBitState = state;
        s.view.paintMode = 'set';
      });
    },

    setActiveBusLabel(label) {
      set((s) => {
        s.view.activeBusLabel = label;
      });
    },

    setActiveTimespanLabel(label) {
      set((s) => {
        s.view.activeTimespanLabel = label;
      });
    },

    setEdgeToolHover(hover) {
      set((s) => {
        s.view.edgeToolHover = hover;
      });
    },

    setActiveBusColorIndex(index: WavedromColorIndex) {
      set((s) => {
        s.view.activeBusColorIndex = index;
      });
    },

    setPaintMode(mode: PaintMode) {
      set((s) => {
        s.view.paintMode = mode;
      });
    },

    toggleCodePanel() {
      set((s) => {
        s.view.showCodePanel = !s.view.showCodePanel;
      });
    },

    toggleRenderPanel() {
      set((s) => {
        s.view.showRenderPanel = !s.view.showRenderPanel;
      });
    },

    setLabelWidth(width) {
      const next = clampLabelColumnWidth(width);
      set((s) => {
        s.view.labelWidth = next;
      });
      saveLabelColumnWidth(next);
    },

    toggleTimeAxis() {
      set((s) => {
        s.view.showTimeAxis = !s.view.showTimeAxis;
      });
    },

    setTheme(theme: Theme) {
      set((s) => {
        s.view.theme = theme;
        persistTheme(s.view);
      });
    },

    setAccentColor(color) {
      set((s) => {
        s.view.accentColor = color;
        persistTheme(s.view);
      });
    },

    setCanvasColor(color) {
      set((s) => {
        s.view.canvasColor = color;
        persistTheme(s.view);
      });
    },

    setUiFontScale(scale) {
      set((s) => {
        s.view.uiFontScale = Math.max(0.9, Math.min(1.15, scale));
        persistTheme(s.view);
      });
    },
  };
}
