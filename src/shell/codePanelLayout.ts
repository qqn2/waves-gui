import {
  useCallback,
  useState,
  createContext,
  useContext,
  createElement,
  type ReactNode,
} from 'react';
import { getSafeStorage } from './soloDesk/safeStorage';

export type CodePanelPlacement = 'bottom' | 'right' | 'float';
export type SidePanelId = 'json' | 'render';

export interface DockPanelLayout {
  placement: CodePanelPlacement;
  /** Height when bottom-docked, or width when right-docked (px). */
  dockSize: number;
  floatRect: { x: number; y: number; w: number; h: number };
}

export interface SidePanelsLayoutState {
  json: DockPanelLayout;
  render: DockPanelLayout;
  /** Stacking order toward canvas first (right dock: leftmost; bottom dock: topmost). */
  panelOrder: SidePanelId[];
}

/** Default: Render beside/above JSON when both share a dock edge. */
export const DEFAULT_PANEL_ORDER: SidePanelId[] = ['render', 'json'];

/** @deprecated use SidePanelsLayoutState */
export type CodePanelLayoutState = SidePanelsLayoutState;

export const CODE_PANEL_LAYOUT_KEY = 'wavedrom-gui-code-panel-layout';

export const CODE_PANEL_DOCK_MIN = 140;
export const CODE_PANEL_DOCK_MAX_RATIO = 0.72;
export const CODE_PANEL_DOCK_DEFAULT_BOTTOM = 280;
export const CODE_PANEL_DOCK_DEFAULT_RIGHT = 440;
export const CODE_PANEL_DOCK_DEFAULT_RENDER_BOTTOM = 240;

export const CODE_PANEL_FLOAT_MIN_W = 320;
export const CODE_PANEL_FLOAT_MIN_H = 200;
export const CODE_PANEL_FLOAT_DEFAULT = {
  x: 72,
  y: 72,
  w: 520,
  h: 420,
};
export const CODE_PANEL_RENDER_FLOAT_DEFAULT = {
  x: 96,
  y: 96,
  w: 480,
  h: 320,
};

const VALID_PLACEMENTS: CodePanelPlacement[] = ['bottom', 'right', 'float'];

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

function clampFloatRect(
  rect: DockPanelLayout['floatRect'],
): DockPanelLayout['floatRect'] {
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

export function defaultDockPanelLayout(panelId: SidePanelId): DockPanelLayout {
  if (panelId === 'json') {
    return {
      placement: 'right',
      dockSize: CODE_PANEL_DOCK_DEFAULT_RIGHT,
      floatRect: { ...CODE_PANEL_FLOAT_DEFAULT },
    };
  }
  return {
    placement: 'bottom',
    dockSize: CODE_PANEL_DOCK_DEFAULT_RENDER_BOTTOM,
    floatRect: { ...CODE_PANEL_RENDER_FLOAT_DEFAULT },
  };
}

export function defaultSidePanelsLayout(): SidePanelsLayoutState {
  return {
    json: defaultDockPanelLayout('json'),
    render: defaultDockPanelLayout('render'),
    panelOrder: [...DEFAULT_PANEL_ORDER],
  };
}

export function normalizePanelOrder(raw: unknown): SidePanelId[] {
  if (!Array.isArray(raw)) return [...DEFAULT_PANEL_ORDER];
  const filtered = raw.filter(
    (id): id is SidePanelId => id === 'json' || id === 'render',
  );
  if (filtered.length !== 2 || new Set(filtered).size !== 2) {
    return [...DEFAULT_PANEL_ORDER];
  }
  return filtered;
}

export function movePanelInOrder(
  order: SidePanelId[],
  panelId: SidePanelId,
  direction: -1 | 1,
): SidePanelId[] {
  const idx = order.indexOf(panelId);
  if (idx < 0) return order;
  const nextIdx = idx + direction;
  if (nextIdx < 0 || nextIdx >= order.length) return order;
  const next = [...order];
  [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
  return next;
}

export function dockSlotsForPlacement(
  order: SidePanelId[],
  placement: CodePanelPlacement,
  layouts: SidePanelsLayoutState,
  visible: Record<SidePanelId, boolean>,
): { panelId: SidePanelId; layout: DockPanelLayout }[] {
  return order
    .filter((id) => visible[id] && layouts[id].placement === placement)
    .map((id) => ({ panelId: id, layout: layouts[id] }));
}

/** @deprecated use defaultSidePanelsLayout */
export function defaultCodePanelLayout(): SidePanelsLayoutState {
  return defaultSidePanelsLayout();
}

export function normalizeDockPanelLayout(
  raw: Partial<DockPanelLayout> | null | undefined,
  panelId: SidePanelId,
): DockPanelLayout {
  const base = defaultDockPanelLayout(panelId);
  if (!raw || typeof raw !== 'object') return base;

  const placement = VALID_PLACEMENTS.includes(raw.placement as CodePanelPlacement)
    ? (raw.placement as CodePanelPlacement)
    : base.placement;

  const axis = placement === 'right' ? 'x' : 'y';
  const defaultDock =
    placement === 'right'
      ? CODE_PANEL_DOCK_DEFAULT_RIGHT
      : panelId === 'json'
        ? CODE_PANEL_DOCK_DEFAULT_BOTTOM
        : CODE_PANEL_DOCK_DEFAULT_RENDER_BOTTOM;

  const dockSize =
    typeof raw.dockSize === 'number' && Number.isFinite(raw.dockSize)
      ? clampDockSize(raw.dockSize, axis)
      : defaultDock;

  const fr = raw.floatRect;
  const floatRect = clampFloatRect({
    x: typeof fr?.x === 'number' ? fr.x : base.floatRect.x,
    y: typeof fr?.y === 'number' ? fr.y : base.floatRect.y,
    w: typeof fr?.w === 'number' ? fr.w : base.floatRect.w,
    h: typeof fr?.h === 'number' ? fr.h : base.floatRect.h,
  });

  return { placement, dockSize, floatRect };
}

type LegacyLayoutRaw = Partial<DockPanelLayout> & {
  previewSplit?: number;
  jsonPanelShare?: number;
  viewMode?: string;
};

export type SidePanelsLayoutInput =
  | ({
      json?: Partial<DockPanelLayout>;
      render?: Partial<DockPanelLayout>;
      panelOrder?: unknown;
    } & LegacyLayoutRaw)
  | null
  | undefined;

function normalizeLegacySingleLayout(raw: LegacyLayoutRaw): DockPanelLayout {
  return normalizeDockPanelLayout(
    {
      placement: raw.placement,
      dockSize: raw.dockSize,
      floatRect: raw.floatRect,
    },
    'json',
  );
}

export function normalizeSidePanelsLayout(
  raw: SidePanelsLayoutInput,
): SidePanelsLayoutState {
  const base = defaultSidePanelsLayout();
  if (!raw || typeof raw !== 'object') return base;

  if (raw.json || raw.render) {
    return {
      json: normalizeDockPanelLayout(raw.json, 'json'),
      render: normalizeDockPanelLayout(raw.render, 'render'),
      panelOrder: normalizePanelOrder(raw.panelOrder),
    };
  }

  return {
    json: normalizeLegacySingleLayout(raw),
    render: base.render,
    panelOrder: normalizePanelOrder(raw.panelOrder),
  };
}

/** @deprecated use normalizeSidePanelsLayout */
export function normalizeCodePanelLayout(
  raw: LegacyLayoutRaw | null | undefined,
): SidePanelsLayoutState {
  return normalizeSidePanelsLayout(raw);
}

export function loadSidePanelsLayout(): SidePanelsLayoutState {
  try {
    const raw = getSafeStorage().getItem(CODE_PANEL_LAYOUT_KEY);
    if (!raw) return defaultSidePanelsLayout();
    return normalizeSidePanelsLayout(JSON.parse(raw) as Partial<SidePanelsLayoutState>);
  } catch {
    return defaultSidePanelsLayout();
  }
}

/** @deprecated use loadSidePanelsLayout */
export function loadCodePanelLayout(): SidePanelsLayoutState {
  return loadSidePanelsLayout();
}

export function saveSidePanelsLayout(layout: SidePanelsLayoutState): void {
  try {
    getSafeStorage().setItem(CODE_PANEL_LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // ignore quota / private mode
  }
}

/** @deprecated use saveSidePanelsLayout */
export function saveCodePanelLayout(layout: SidePanelsLayoutState): void {
  saveSidePanelsLayout(layout);
}

export function useSidePanelsLayout(): [
  SidePanelsLayoutState,
  (panelId: SidePanelId, patch: Partial<DockPanelLayout>) => void,
  (panelId: SidePanelId, direction: -1 | 1) => void,
] {
  const [layout, setLayout] = useState(loadSidePanelsLayout);

  const updatePanelLayout = useCallback(
    (panelId: SidePanelId, patch: Partial<DockPanelLayout>) => {
      setLayout((prev) => {
        const current = prev[panelId];
        const merged = { ...current, ...patch };
        if (patch.placement && patch.placement !== current.placement) {
          if (patch.placement === 'right') {
            merged.dockSize = CODE_PANEL_DOCK_DEFAULT_RIGHT;
          } else if (patch.placement === 'bottom') {
            merged.dockSize =
              panelId === 'json'
                ? CODE_PANEL_DOCK_DEFAULT_BOTTOM
                : CODE_PANEL_DOCK_DEFAULT_RENDER_BOTTOM;
          }
        }
        const next = normalizeSidePanelsLayout({
          ...prev,
          [panelId]: merged,
        });
        saveSidePanelsLayout(next);
        return next;
      });
    },
    [],
  );

  const movePanelInOrderAction = useCallback(
    (panelId: SidePanelId, direction: -1 | 1) => {
      setLayout((prev) => {
        const panelOrder = movePanelInOrder(prev.panelOrder, panelId, direction);
        if (panelOrder.every((id, i) => id === prev.panelOrder[i])) return prev;
        const next = normalizeSidePanelsLayout({ ...prev, panelOrder });
        saveSidePanelsLayout(next);
        return next;
      });
    },
    [],
  );

  return [layout, updatePanelLayout, movePanelInOrderAction];
}

type SidePanelsLayoutContextValue = ReturnType<typeof useSidePanelsLayout>;

const SidePanelsLayoutContext = createContext<SidePanelsLayoutContextValue | null>(
  null,
);

export function CodePanelLayoutProvider({ children }: { children: ReactNode }) {
  const value = useSidePanelsLayout();
  return createElement(SidePanelsLayoutContext.Provider, { value }, children);
}

export function useSharedSidePanelsLayout(): SidePanelsLayoutContextValue {
  const ctx = useContext(SidePanelsLayoutContext);
  if (!ctx) {
    throw new Error('useSharedSidePanelsLayout requires CodePanelLayoutProvider');
  }
  return ctx;
}

/** @deprecated use useSharedSidePanelsLayout */
export function useSharedCodePanelLayout(): SidePanelsLayoutContextValue {
  return useSharedSidePanelsLayout();
}
