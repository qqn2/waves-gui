import { useCallback, useState } from 'react';
import { getSafeStorage } from './soloDesk/safeStorage';

export type CodePanelPlacement = 'bottom' | 'right' | 'float';

export interface CodePanelLayoutState {
  placement: CodePanelPlacement;
  /** Height when bottom-docked, or width when right-docked (px). */
  dockSize: number;
  /** Editor share when JSON + Preview split is open (0–1). */
  previewSplit: number;
  floatRect: { x: number; y: number; w: number; h: number };
}

export const CODE_PANEL_PREVIEW_SPLIT_MIN = 0.2;
export const CODE_PANEL_PREVIEW_SPLIT_MAX = 0.8;
export const CODE_PANEL_PREVIEW_SPLIT_DEFAULT = 0.45;

export const CODE_PANEL_LAYOUT_KEY = 'wavedrom-gui-code-panel-layout';

export const CODE_PANEL_DOCK_MIN = 140;
export const CODE_PANEL_DOCK_MAX_RATIO = 0.72;
export const CODE_PANEL_DOCK_DEFAULT_BOTTOM = 260;
export const CODE_PANEL_DOCK_DEFAULT_RIGHT = 380;

export const CODE_PANEL_FLOAT_MIN_W = 320;
export const CODE_PANEL_FLOAT_MIN_H = 200;
export const CODE_PANEL_FLOAT_DEFAULT = {
  x: 72,
  y: 72,
  w: 520,
  h: 420,
};

const VALID_PLACEMENTS: CodePanelPlacement[] = ['bottom', 'right', 'float'];

function clampPreviewSplit(ratio: number): number {
  return Math.max(
    CODE_PANEL_PREVIEW_SPLIT_MIN,
    Math.min(CODE_PANEL_PREVIEW_SPLIT_MAX, ratio),
  );
}

export function defaultCodePanelLayout(): CodePanelLayoutState {
  return {
    placement: 'bottom',
    dockSize: CODE_PANEL_DOCK_DEFAULT_BOTTOM,
    previewSplit: CODE_PANEL_PREVIEW_SPLIT_DEFAULT,
    floatRect: { ...CODE_PANEL_FLOAT_DEFAULT },
  };
}

function clampDockSize(size: number, axis: 'x' | 'y'): number {
  const max =
    typeof window !== 'undefined'
      ? Math.floor(
          (axis === 'y' ? window.innerHeight : window.innerWidth) *
            CODE_PANEL_DOCK_MAX_RATIO,
        )
      : 800;
  return Math.max(CODE_PANEL_DOCK_MIN, Math.min(max, size));
}

function clampFloatRect(rect: CodePanelLayoutState['floatRect']): CodePanelLayoutState['floatRect'] {
  if (typeof window === 'undefined') return rect;
  const w = Math.max(
    CODE_PANEL_FLOAT_MIN_W,
    Math.min(window.innerWidth - 24, rect.w),
  );
  const h = Math.max(
    CODE_PANEL_FLOAT_MIN_H,
    Math.min(window.innerHeight - 24, rect.h),
  );
  const x = Math.max(8, Math.min(window.innerWidth - w - 8, rect.x));
  const y = Math.max(8, Math.min(window.innerHeight - h - 8, rect.y));
  return { x, y, w, h };
}

export function normalizeCodePanelLayout(
  raw: Partial<CodePanelLayoutState> | null | undefined,
): CodePanelLayoutState {
  const base = defaultCodePanelLayout();
  if (!raw || typeof raw !== 'object') return base;

  const placement = VALID_PLACEMENTS.includes(raw.placement as CodePanelPlacement)
    ? (raw.placement as CodePanelPlacement)
    : base.placement;

  const axis = placement === 'right' ? 'x' : 'y';
  const dockSize =
    typeof raw.dockSize === 'number' && Number.isFinite(raw.dockSize)
      ? clampDockSize(raw.dockSize, axis)
      : placement === 'right'
        ? CODE_PANEL_DOCK_DEFAULT_RIGHT
        : CODE_PANEL_DOCK_DEFAULT_BOTTOM;

  const fr = raw.floatRect;
  const floatRect = clampFloatRect({
    x: typeof fr?.x === 'number' ? fr.x : base.floatRect.x,
    y: typeof fr?.y === 'number' ? fr.y : base.floatRect.y,
    w: typeof fr?.w === 'number' ? fr.w : base.floatRect.w,
    h: typeof fr?.h === 'number' ? fr.h : base.floatRect.h,
  });

  const previewSplit =
    typeof raw.previewSplit === 'number' && Number.isFinite(raw.previewSplit)
      ? clampPreviewSplit(raw.previewSplit)
      : base.previewSplit;

  return { placement, dockSize, previewSplit, floatRect };
}

export function loadCodePanelLayout(): CodePanelLayoutState {
  try {
    const raw = getSafeStorage().getItem(CODE_PANEL_LAYOUT_KEY);
    if (!raw) return defaultCodePanelLayout();
    return normalizeCodePanelLayout(JSON.parse(raw) as Partial<CodePanelLayoutState>);
  } catch {
    return defaultCodePanelLayout();
  }
}

export function saveCodePanelLayout(layout: CodePanelLayoutState): void {
  try {
    getSafeStorage().setItem(CODE_PANEL_LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // ignore quota / private mode
  }
}

export function useCodePanelLayout(): [
  CodePanelLayoutState,
  (patch: Partial<CodePanelLayoutState>) => void,
] {
  const [layout, setLayout] = useState(loadCodePanelLayout);

  const updateLayout = useCallback((patch: Partial<CodePanelLayoutState>) => {
    setLayout((prev) => {
      const merged = { ...prev, ...patch };
      if (patch.placement && patch.placement !== prev.placement) {
        if (patch.placement === 'right' && prev.placement === 'bottom') {
          merged.dockSize = CODE_PANEL_DOCK_DEFAULT_RIGHT;
        } else if (patch.placement === 'bottom' && prev.placement === 'right') {
          merged.dockSize = CODE_PANEL_DOCK_DEFAULT_BOTTOM;
        }
      }
      const next = normalizeCodePanelLayout(merged);
      saveCodePanelLayout(next);
      return next;
    });
  }, []);

  return [layout, updateLayout];
}
