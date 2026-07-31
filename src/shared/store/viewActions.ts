import type {
  AnalogueTransition,
  BitState,
  PaintMode,
  PaintStyle,
  Theme,
  Tool,
} from '../types';
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
  | 'setActiveAnalogueKind'
  | 'setActiveAnalogueValue'
  | 'setActiveBusLabel'
  | 'setActiveTimespanLabel'
  | 'setActiveEdgeLabel'
  | 'setActiveBusColorIndex'
  | 'setActiveTimingCellIndex'
  | 'setAnnotationSnapToGrid'
  | 'setEdgeToolHover'
  | 'setStructuredArrowPending'
  | 'setPaintMode'
  | 'setPaintStyle'
  | 'toggleGroupCollapsed'
  | 'toggleInspector'
  | 'toggleCodePanel'
  | 'toggleRenderPanel'
  | 'setLabelWidth'
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

    setActiveAnalogueKind(kind: AnalogueTransition) {
      set((s) => {
        s.view.activeAnalogueKind = kind;
      });
    },

    setActiveAnalogueValue(value: number) {
      if (!Number.isFinite(value)) return;
      set((s) => {
        s.view.activeAnalogueValue = value;
      });
    },

    setActiveEdgeLabel(label) {
      set((s) => {
        s.view.activeEdgeLabel = label;
      });
    },

    setEdgeToolHover(hover) {
      set((s) => {
        s.view.edgeToolHover = hover;
      });
    },

    setStructuredArrowPending(pending) {
      set((s) => {
        s.view.structuredArrowPending = pending;
      });
    },

    setActiveBusColorIndex(index: WavedromColorIndex) {
      set((s) => {
        s.view.activeBusColorIndex = index;
      });
    },

    setActiveTimingCellIndex(index) {
      set((s) => {
        s.view.activeTimingCellIndex = index === null
          ? null
          : Math.max(0, Math.floor(index));
      });
    },

    setAnnotationSnapToGrid(enabled) {
      set((s) => {
        s.view.annotationSnapToGrid = enabled;
      });
    },

    setPaintMode(mode: PaintMode) {
      set((s) => {
        s.view.paintMode = mode;
      });
    },

    setPaintStyle(style: PaintStyle) {
      set((s) => {
        s.view.paintStyle = style;
      });
    },

    toggleGroupCollapsed(groupId) {
      set((s) => {
        const index = s.view.collapsedGroupIds.indexOf(groupId);
        if (index >= 0) s.view.collapsedGroupIds.splice(index, 1);
        else s.view.collapsedGroupIds.push(groupId);
      });
    },

    toggleInspector() {
      set((s) => {
        s.view.showInspector = !s.view.showInspector;
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
