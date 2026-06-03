import type { BitState, PaintMode, Theme, Tool } from '../types';
import type { WavedromColorIndex } from '../../wavedromBridge/wavedromColors';
import { MIN_ZOOM, MAX_ZOOM } from '../constants';
import { saveStoredTheme } from '../theme';
import {
  clampLabelColumnWidth,
  saveLabelColumnWidth,
} from '../../shell/labelColumnLayout';
import type { ImmerSet, StoreActions } from './storeActions';

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
  | 'setLabelWidth'
  | 'toggleTimeAxis'
  | 'setTheme'
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
      saveStoredTheme(theme);
      set((s) => {
        s.view.theme = theme;
      });
    },
  };
}
