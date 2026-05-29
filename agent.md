# WaveDrom GUI Editor — Parallel Build Plan

> **Goal:** A browser-based interactive GUI for WaveDrom — an interactive timing diagram editor. Users draw digital timing diagrams visually; the app keeps a live WaveDrom JSON representation in sync. No VCD support. All processing runs client-side.

---

## Solo desk scope (architecture fork A)

**Target user:** one engineer at a desk editing timing diagrams next to RTL or specs.

**In scope**

- Client-only SPA: no API server, no database, no auth, no real-time collaboration.
- **Source of truth:** WaveDrom-compatible JSON on disk (Open/Save) or clipboard; Git in the repo handles versions and sharing.
- Core loop: visual edit (bit signals first) ↔ live JSON panel ↔ export PNG/SVG when needed.
- Optional **local-only** helpers: `localStorage` crash-recovery draft, recent file *names*, bundled samples — not cloud persistence.

**Explicitly out of scope (do not re-open without a new user story)**

- `backend/`, Postgres/SQLite, diagram libraries, team permissions, hosted storage.
- VCD import/export, annotation overlays in the main UI (not WaveDrom-exportable).
- Extended reference-editor features listed as out of scope in `ORCHESTRATOR_PROMPT.md`.

**Deployment:** static `dist/` (e.g. `make build`, `make preview`, or internal nginx). `make back-end` remains a no-op stub until a future *team* fork explicitly requests path B/C.

---

## How to Use This Document

**Phase 0** must be completed (or at least the TypeScript interfaces agreed upon) before any tracks begin.
**Tracks A–I** are independent and can run in parallel once Phase 0 is done.
Each track lists exactly which files it owns — no track touches another track's files.
Track E depends on Track D being done first. Track F and G depend on Track A being done first. All others are independent from day 1.

### Critical performance patterns (read before implementing)

These are non-negotiable for responsive UI performance:

| Area | Do | Don't |
|------|----|-------|
| Undo history | `current(state.diagram)` from Immer when pushing inside a producer | `structuredClone` on every mutation (100× deep copies) |
| Label panel scroll | Shared DOM refs + `requestAnimationFrame`; write `scrollTop` directly | Pipe `scrollY` through React state props (one-frame lag / jitter) |
| Paint drag | Update `view.paintDraft` during move; one `setSignalStateRange` + `pushHistory` on pointer up | `setSignalState` per move (history flood) or commit only on up with no draft (invisible stroke) |
| Code ↔ canvas | `flush()` debounced editor sync on canvas `pointerdown` / focus | Let a pending 400ms debounce overwrite canvas edits |

---

## Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite 5 | `npm create vite@latest` with react-ts template |
| Framework | React 18 + TypeScript 5 | Strict mode on |
| State | Zustand 4 + Immer | Single store, immer middleware for mutations |
| Unique IDs | `nanoid` | Used by `store.ts` and pattern generators for signal/segment ids |
| Waveform rendering | Canvas API | `<canvas>` with 2D context, redrawn on state changes |
| Annotation layer | Inline SVG overlay | Positioned absolute over canvas |
| Signal label panel | DOM (React divs) | Scroll-synced with canvas via shared refs + `requestAnimationFrame` (not React state) |
| Code editor | CodeMirror 6 | `@codemirror/view`, `@codemirror/lang-json`, `@codemirror/lint` |
| Debounce | `use-debounce` | `useDebouncedCallback` (has `.flush()`) for Track E editor sync |
| WaveDrom preview | `wavedrom` npm package | Used for the read-only preview pane only |
| Styling | CSS Modules + CSS custom properties | Theme via `:root` vars |
| File save | FileSaver.js | PNG, SVG, JSON exports |
| Icons | Lucide React | Consistent icon set |
| Tests | Vitest | Round-trip / unit tests for Track D and Phase 0 store |

```
npm install zustand immer nanoid use-debounce \
  @codemirror/view @codemirror/state @codemirror/commands \
  @codemirror/lang-json @codemirror/lint \
  wavedrom file-saver lucide-react
npm install -D @types/file-saver vitest
```

> **Note on `wavedrom`:** the npm package is an older CommonJS module (depends on `onml`) and can need Vite interop tweaks (`optimizeDeps.include: ['wavedrom']`, or a dynamic `import()`). Validate it renders in a spike before Track E builds on it. It is only used for the read-only preview pane, so a thin wrapper isolates the risk.

---

## Repository Structure

```
src/
  shared/
    types.ts          ← Phase 0: all TypeScript interfaces (owned by Phase 0)
    constants.ts      ← Phase 0: rendering constants
    store.ts          ← Phase 0: Zustand store definition
    theme.css         ← Track H: CSS custom properties for light/dark
  renderer/           ← Track A: canvas renderer
  signalPanel/        ← Track B: left signal label panel
  tools/              ← Track C: drawing tools engine
  wavedromBridge/     ← Track D: WaveDrom JSON conversion
  codePanel/          ← Track E: CodeMirror live editor
  annotations/        ← Track F: annotation layer
  exportEngine/       ← Track G: PNG/SVG/JPG export
  shell/              ← Track H: app shell, menus, toolbar, layout
  patterns/           ← Track I: predefined signal patterns
  App.tsx
  main.tsx
  index.css
```

---

## Phase 0 — Shared Foundations (Sequential, Do First, ~1–2 days)

**Files owned:** `src/shared/types.ts`, `src/shared/constants.ts`, `src/shared/store.ts`

This phase defines all contracts that parallel tracks depend on. Do not start tracks until these interfaces are stable. Implementations can be stubs — what matters is the type signatures.

### `src/shared/types.ts`

```typescript
// ─── Signal states ────────────────────────────────────────────────────────────

/** All possible states for a single bit signal at one time step */
export type BitState = '0' | '1' | 'x' | 'z' | 'u' | 'd' | 'p' | 'n';

/** Map to WaveDrom wave characters */
export const BIT_STATE_CHARS: Record<BitState, string> = {
  '0': '0', '1': '1', 'x': 'x', 'z': 'z',
  'u': 'u', 'd': 'd', 'p': 'p', 'n': 'n',
};

// ─── Signal types ─────────────────────────────────────────────────────────────

export interface VectorSegment {
  id: string;
  startStep: number;  // inclusive
  endStep: number;    // exclusive
  value: string;      // displayed label (hex / decimal / binary / custom text)
  color?: string;     // optional per-segment fill override
}

export interface Signal {
  id: string;
  name: string;
  type: 'bit' | 'vector' | 'spacer';
  /** Bit signals: one entry per time step. Length always equals DiagramConfig.totalSteps */
  states: BitState[];
  /** Vector signals: non-overlapping segments covering all steps */
  segments: VectorSegment[];
  color: string;       // stroke color, default '#4A9EFF'
  fillColor?: string;  // vector fill, default semi-transparent stroke
  rowHeight: number;   // px at zoom=1, default 40
  phase?: number;      // clock phase offset (0 or 0.5), for 'p'/'n' type signals
}

export interface SignalGroup {
  id: string;
  name: string;
  type: 'group';
  children: Array<Signal | SignalGroup>;
  collapsed: boolean;
  color?: string;  // bracket color
}

export type SignalOrGroup = Signal | SignalGroup;

// ─── Diagram config ───────────────────────────────────────────────────────────

export interface DiagramConfig {
  totalSteps: number;   // number of time step columns
  hscale: number;       // 1–4, multiplier applied to CELL_WIDTH
  head?: { text?: string; tick?: number; every?: number };
  foot?: { text?: string; tock?: number; every?: number };
}

// ─── Annotations ──────────────────────────────────────────────────────────────

export interface ArrowAnnotation {
  id: string;
  type: 'arrow';
  fromSignalId: string;
  fromStep: number;
  toSignalId: string;
  toStep: number;
  label?: string;
  color: string;
}

export interface TimeSpanAnnotation {
  id: string;
  type: 'timespan';
  startStep: number;
  endStep: number;
  label?: string;
  color: string;
  row?: 'top' | 'bottom';  // position above or below all signals
}

export interface TimeMarkerAnnotation {
  id: string;
  type: 'marker';
  step: number;
  label?: string;
  color: string;
}

export interface TextAnnotation {
  id: string;
  type: 'text';
  signalId: string;
  step: number;
  text: string;
  color: string;
}

export type Annotation =
  | ArrowAnnotation
  | TimeSpanAnnotation
  | TimeMarkerAnnotation
  | TextAnnotation;

// ─── Diagram state (the saved document) ──────────────────────────────────────

export interface DiagramState {
  version: 1;
  signals: SignalOrGroup[];
  config: DiagramConfig;
  annotations: Annotation[];
}

// ─── View/UI state ────────────────────────────────────────────────────────────

export type Tool = 'paint' | 'erase' | 'select' | 'arrow' | 'timespan' | 'marker' | 'text' | 'cursor';

export type Theme = 'dark' | 'light';

export interface ViewState {
  zoom: number;          // 0.25–4.0, default 1.0
  scrollX: number;       // canvas horizontal scroll in logical px
  scrollY: number;       // canvas vertical scroll in logical px
  selectedTool: Tool;
  activeBitState: BitState;   // the state the paint tool will apply
  activeSignalIds: string[];  // selected for operations
  showCodePanel: boolean;
  showTimeAxis: boolean;
  theme: Theme;
  isDirty: boolean;      // unsaved changes
  fileName: string | null;
  /** Ephemeral paint/erase preview during pointer drag — never pushed to undo history */
  paintDraft: PaintDraft | null;
}

/** In-progress stroke from the paint or erase tool; cleared on pointer up */
export interface PaintDraft {
  signalId: string;
  startStep: number;
  endStep: number;   // inclusive; grows during drag
  bitState: BitState; // paint: target state; erase: ignored (erase uses propagate-left logic in renderer)
  mode: 'paint' | 'erase';
}

// ─── Full app store shape ─────────────────────────────────────────────────────

export interface AppState {
  diagram: DiagramState;
  view: ViewState;
  history: DiagramState[];  // undo stack (most recent last)
  future: DiagramState[];   // redo stack
}
```

### `src/shared/constants.ts`

```typescript
/** Base cell width in logical pixels at zoom 1.0. Multiply by hscale and zoom for canvas px. */
export const CELL_WIDTH = 40;

/** Base row height in logical pixels at zoom 1.0. Multiply by zoom for canvas px. */
export const ROW_HEIGHT = 40;

/** Height of group header rows */
export const GROUP_HEADER_HEIGHT = 28;

/** Width of the signal label panel in px (DOM, not zoomed) */
export const LABEL_WIDTH = 160;

/** Height of the time axis bar in px (DOM, not zoomed) */
export const TIME_AXIS_HEIGHT = 24;

/** Vertical padding inside a row between the trace extremes and the row edges */
export const TRACE_PADDING = 8;

/** Width of a state transition diagonal, in logical px */
export const TRANSITION_WIDTH = 6;

/** Diagonal width for vector/bus segment ends, in logical px */
export const BUS_DIAGONAL = 8;

/** Max undo history depth */
export const MAX_HISTORY = 100;

export const DEFAULT_SIGNAL_COLOR = '#4A9EFF';
export const DEFAULT_STEPS = 20;
export const DEFAULT_HSCALE = 1;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4.0;
```

### `src/shared/store.ts`

Create the Zustand store with Immer middleware. Define all action signatures here; implement them fully in this phase.

**Define the `Actions` interface explicitly** — do not try to infer it from the implementation. This interface is the contract every track codes against, so it must be readable on its own:

```typescript
import type { ImageExportOptions } from './types'; // if shared; otherwise per-track

export interface Actions {
  // Signals
  addSignal(type: Signal['type'], afterId?: string): void;
  removeSignal(id: string): void;
  renameSignal(id: string, name: string): void;
  setSignalState(signalId: string, step: number, bitState: BitState): void;
  setSignalStateRange(signalId: string, startStep: number, endStep: number, bitState: BitState): void;
  eraseSignalState(signalId: string, step: number): void;
  eraseSignalStateRange(signalId: string, startStep: number, endStep: number): void;
  reorderSignals(orderedIds: string[]): void;
  updateSignalColor(id: string, color: string): void;
  setTotalSteps(steps: number): void;
  setHscale(hscale: number): void;
  // Annotations
  addAnnotation(annotation: Annotation): void;
  updateAnnotation(id: string, updates: Partial<Annotation>): void;
  removeAnnotation(id: string): void;
  // Document
  loadDiagram(diagram: DiagramState): void;
  clearAll(): void;
  markClean(fileName: string): void;
  // History + paint draft
  undo(): void;
  redo(): void;
  setPaintDraft(draft: PaintDraft): void;
  clearPaintDraft(): void;
  // View
  setZoom(zoom: number): void;
  setScroll(x: number, y: number): void;
  setTool(tool: Tool): void;
  setActiveBitState(state: BitState): void;
  toggleCodePanel(): void;
  toggleTimeAxis(): void;
  setTheme(theme: Theme): void;
}
```

```typescript
import { create } from 'zustand';
import { current } from 'immer';
import { immer } from 'zustand/middleware/immer';
import type { AppState, DiagramState, Signal, SignalGroup, SignalOrGroup,
  BitState, VectorSegment, Annotation, Tool, Theme, ViewState } from './types';
import { DEFAULT_STEPS, DEFAULT_HSCALE, DEFAULT_SIGNAL_COLOR,
  MAX_HISTORY, MIN_ZOOM, MAX_ZOOM } from './constants';
import { nanoid } from 'nanoid';  // npm install nanoid

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultDiagram(): DiagramState {
  return {
    version: 1,
    signals: [],
    config: { totalSteps: DEFAULT_STEPS, hscale: DEFAULT_HSCALE },
    annotations: [],
  };
}

function defaultView(): ViewState {
  return {
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    selectedTool: 'paint',
    activeBitState: '1',
    activeSignalIds: [],
    showCodePanel: false,
    showTimeAxis: true,
    theme: 'dark',
    isDirty: false,
    fileName: null,
    paintDraft: null,
  };
}

/** Snapshot diagram for undo. Use immer `current()` — do NOT structuredClone.
 *  Immer already produces cheap immutable trees; deep-cloning 100 entries on every
 *  paint stroke would bloat memory and trigger GC pauses. */
function pushHistory(state: AppState) {
  state.history.push(current(state.diagram));
  if (state.history.length > MAX_HISTORY) state.history.shift();
  state.future = [];
  state.view.isDirty = true;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create<AppState & Actions>()(
  immer((set, get) => ({
    diagram: defaultDiagram(),
    view: defaultView(),
    history: [],
    future: [],

    // ── Signal mutations ────────────────────────────────────────────────────

    addSignal(type, afterId) { set(s => {
      pushHistory(s);
      const states = new Array<BitState>(s.diagram.config.totalSteps).fill('0');
      const signal: Signal = {
        id: nanoid(), name: type === 'vector' ? 'bus' : 'sig',
        type, states,
        segments: type === 'vector' ? [{
          id: nanoid(), startStep: 0,
          endStep: s.diagram.config.totalSteps, value: '0',
        }] : [],
        color: DEFAULT_SIGNAL_COLOR, rowHeight: 40,
      };
      // Insert after afterId, or append
      const idx = afterId
        ? s.diagram.signals.findIndex(sg => sg.id === afterId) + 1
        : s.diagram.signals.length;
      s.diagram.signals.splice(idx, 0, signal);
    }); },

    removeSignal(id) { set(s => {
      pushHistory(s);
      s.diagram.signals = s.diagram.signals.filter(sg => sg.id !== id);
      // Also remove annotations referencing this signal
      s.diagram.annotations = s.diagram.annotations.filter(a =>
        !('fromSignalId' in a && a.fromSignalId === id) &&
        !('toSignalId' in a && a.toSignalId === id) &&
        !('signalId' in a && (a as any).signalId === id)
      );
    }); },

    renameSignal(id, name) { set(s => {
      pushHistory(s);
      findSignal(s.diagram.signals, id, sig => { sig.name = name; });
    }); },

    setSignalState(signalId, step, bitState) { set(s => {
      pushHistory(s);
      findSignal(s.diagram.signals, signalId, sig => {
        if (sig.type === 'bit') sig.states[step] = bitState;
      });
    }); },

    setSignalStateRange(signalId, startStep, endStep, bitState) { set(s => {
      pushHistory(s);
      findSignal(s.diagram.signals, signalId, sig => {
        if (sig.type === 'bit') {
          for (let i = startStep; i <= endStep; i++) sig.states[i] = bitState;
        }
      });
    }); },

    eraseSignalState(signalId, step) { set(s => {
      pushHistory(s);
      findSignal(s.diagram.signals, signalId, sig => {
        if (sig.type === 'bit') {
          sig.states[step] = step > 0 ? sig.states[step - 1] : '0';
        }
      });
    }); },

    /** Batched erase for one pointer stroke — single pushHistory */
    eraseSignalStateRange(signalId, startStep, endStep) { set(s => {
      pushHistory(s);
      const lo = Math.min(startStep, endStep);
      const hi = Math.max(startStep, endStep);
      findSignal(s.diagram.signals, signalId, sig => {
        if (sig.type !== 'bit') return;
        for (let i = lo; i <= hi; i++)
          sig.states[i] = i > 0 ? sig.states[i - 1] : '0';
      });
    }); },

    reorderSignals(orderedIds) { set(s => {
      pushHistory(s);
      const map = new Map(s.diagram.signals.map(sg => [sg.id, sg]));
      s.diagram.signals = orderedIds.map(id => map.get(id)!).filter(Boolean);
    }); },

    updateSignalColor(id, color) { set(s => {
      findSignal(s.diagram.signals, id, sig => { sig.color = color; });
      s.view.isDirty = true;
    }); },

    setTotalSteps(steps) { set(s => {
      pushHistory(s);
      const old = s.diagram.config.totalSteps;
      s.diagram.config.totalSteps = steps;
      // Resize all bit signal state arrays
      resizeAllStates(s.diagram.signals, steps, old);
    }); },

    setHscale(hscale) { set(s => {
      s.diagram.config.hscale = Math.max(1, Math.min(4, hscale));
      s.view.isDirty = true;
    }); },

    // ── Annotations ─────────────────────────────────────────────────────────

    addAnnotation(annotation) { set(s => {
      pushHistory(s);
      s.diagram.annotations.push(annotation);
    }); },

    updateAnnotation(id, updates) { set(s => {
      const idx = s.diagram.annotations.findIndex(a => a.id === id);
      if (idx !== -1) Object.assign(s.diagram.annotations[idx], updates);
      s.view.isDirty = true;
    }); },

    removeAnnotation(id) { set(s => {
      pushHistory(s);
      s.diagram.annotations = s.diagram.annotations.filter(a => a.id !== id);
    }); },

    // ── Document operations ──────────────────────────────────────────────────

    loadDiagram(diagram) { set(s => {
      s.history = [];
      s.future = [];
      s.diagram = diagram;
      s.view.isDirty = false;
      s.view.scrollX = 0;
      s.view.scrollY = 0;
    }); },

    clearAll() { set(s => {
      pushHistory(s);
      s.diagram.signals = [];
      s.diagram.annotations = [];
    }); },

    markClean(fileName) { set(s => {
      s.view.isDirty = false;
      s.view.fileName = fileName;
    }); },

    // ── History ──────────────────────────────────────────────────────────────

    undo() { set(s => {
      if (s.history.length === 0) return;
      s.future.push(current(s.diagram));
      s.diagram = s.history.pop()!;
      s.view.paintDraft = null;
    }); },

    redo() { set(s => {
      if (s.future.length === 0) return;
      s.history.push(current(s.diagram));
      s.diagram = s.future.pop()!;
      s.view.paintDraft = null;
    }); },

    setPaintDraft(draft) { set(s => { s.view.paintDraft = draft; }); },

    clearPaintDraft() { set(s => { s.view.paintDraft = null; }); },

    // ── View ─────────────────────────────────────────────────────────────────

    setZoom(zoom) { set(s => {
      s.view.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    }); },

    setScroll(x, y) { set(s => {
      s.view.scrollX = Math.max(0, x);
      s.view.scrollY = Math.max(0, y);
    }); },

    setTool(tool) { set(s => { s.view.selectedTool = tool; }); },

    setActiveBitState(state) { set(s => { s.view.activeBitState = state; }); },

    toggleCodePanel() { set(s => { s.view.showCodePanel = !s.view.showCodePanel; }); },

    toggleTimeAxis() { set(s => { s.view.showTimeAxis = !s.view.showTimeAxis; }); },

    setTheme(theme) { set(s => { s.view.theme = theme; }); },
  }))
);
```

The store is typed `create<AppState & Actions>()` using the explicit `Actions` interface above — TypeScript checks the implementation against it, so a missing or mis-typed action is a compile error.

**Helper utilities to also implement in `store.ts`:**

```typescript
/** Walk the signal tree to find a signal by id, call fn on it. Recurses into groups. */
function findSignal(
  signals: SignalOrGroup[],
  id: string,
  fn: (s: Signal) => void
): boolean { /* recursive tree walk */ }

/** Remove a signal/group by id anywhere in the tree (recurses into group children) */
function removeFromTree(signals: SignalOrGroup[], id: string): SignalOrGroup[] { /* recursive filter */ }

/** After totalSteps changes, resize all bit signal state arrays */
function resizeAllStates(
  signals: SignalOrGroup[],
  newLen: number,
  oldLen: number
): void { /* if growing, pad with last state; if shrinking, truncate */ }
```

> [!IMPORTANT]
> **The store snippet above shows flat-array operations for clarity, but groups can nest.** Two actions must be implemented recursively against the tree, not the top-level array:
> - `removeSignal` must use `removeFromTree` (and `findSignal`/`resizeAllStates` already recurse) — a flat `.filter()` cannot delete a signal living inside a group.
> - `reorderSignals` is defined to reorder **siblings within a single parent level** (a group and its children move as a unit, matching Track B's "children move with them" rule). It takes the ordered ids of one level plus the parent group id (`reorderSignals(orderedIds, parentId?)`), not a global flat order. Update the `Actions` signature accordingly if you adopt this; do not attempt to rebuild the whole tree from one flat list.

**Acceptance criteria for Phase 0:**
- All types compile with `tsc --noEmit`
- `Actions` is an explicit exported interface; the store is `create<AppState & Actions>()` so any missing/mis-typed action is a compile error
- Store can be imported and used in a simple test component
- `addSignal`, `setSignalState`, `undo`, `redo` all work correctly
- `findSignal` correctly traverses nested groups; `removeSignal` deletes a signal nested inside a group (not just top-level)
- `pushHistory` uses `current()` from Immer — no `structuredClone` in history/undo/redo
- `setPaintDraft` / `clearPaintDraft` update preview without pushing history
- A Vitest unit test covers add/paint/undo/redo and nested-group removal

---

## Track A — Canvas Renderer

**Can start:** Immediately after Phase 0
**Files owned:** `src/renderer/`
**Depends on:** Phase 0 types and constants only
**Exposes:** `<WaveformCanvas>` component, `hitTest()` utility

### Objective

Render the waveform diagram onto a `<canvas>` element. The canvas shows only the waveform area (not the signal label panel, which is Track B). Handles zoom and horizontal/vertical scroll. Re-renders whenever the diagram state or view state changes via a `requestAnimationFrame` loop or direct redraw trigger.

### File Structure

```
src/renderer/
  WaveformCanvas.tsx     ← React component, owns the <canvas> element
  CanvasRenderer.ts      ← Pure class: draws diagram state onto a canvas context
  hitTest.ts             ← Maps canvas pixel coords → { signalId, step, half }
  renderBitSignal.ts     ← Renders one bit signal row
  renderVectorSignal.ts  ← Renders one vector/bus signal row
  renderTimeAxis.ts      ← Renders the time step axis at top
  renderGrid.ts          ← Renders background grid lines
  stateColors.ts         ← Color constants and state-to-style mappings
  index.ts               ← Re-exports
```

### Coordinate System

All rendering operates in **logical pixels** (zoom=1, hscale=1). Converting to canvas pixels:

```
canvasX(logicalX) = logicalX * zoom * hscale - scrollX
canvasY(logicalY) = logicalY * zoom - scrollY

logicalX(canvasX) = (canvasX + scrollX) / (zoom * hscale)
logicalY(canvasY) = (canvasY + scrollY) / zoom
```

A cell at step `i` occupies logical X range `[i * CELL_WIDTH, (i+1) * CELL_WIDTH)`.
A signal row at flat index `r` occupies logical Y range `[r * ROW_HEIGHT, (r+1) * ROW_HEIGHT)`.
(Group headers have `GROUP_HEADER_HEIGHT`, not `ROW_HEIGHT` — the renderer must walk the signal tree to compute Y offsets, matching exactly what Track B does.)

### `WaveformCanvas.tsx`

```tsx
interface WaveformCanvasProps {
  /** Called on pointer events with hit-test result */
  onPointerEvent: (e: PointerEvent, hit: HitTestResult) => void;
}
```

- Mount a `<canvas>` that fills its container (`width: 100%, height: 100%`)
- Use a `ResizeObserver` to update `canvas.width` / `canvas.height` on container resize (always set physical pixels, account for `devicePixelRatio`)
- Subscribe to Zustand store; call `renderer.draw()` whenever diagram or relevant view state changes
- Forward pointer events (down, move, up) to `onPointerEvent` with attached hit-test results
- On wheel / programmatic vertical scroll: update `view.scrollX` / `view.scrollY` in the store **and** call `scrollSync.applyCanvasScrollY(scrollY)` (see Track B) inside `requestAnimationFrame` — do not rely on React re-rendering the label panel

### `CanvasRenderer.ts`

```typescript
class CanvasRenderer {
  constructor(ctx: CanvasRenderingContext2D) {}

  draw(
    diagram: DiagramState,
    view: ViewState,
    canvasWidth: number,
    canvasHeight: number
  ): void

  // Internal draw sequence:
  // 1. clearRect
  // 2. Save ctx state, apply devicePixelRatio scale
  // 3. renderGrid (optional, based on view.showGrid)
  // 4. renderTimeAxis (if view.showTimeAxis)
  // 5. Walk diagram.signals, renderRow for each visible signal
  // 6. If view.paintDraft: overlay draft cells on the target signal (steps startStep..endStep)
  // 7. Restore ctx state
}
```

**Paint draft overlay:** When `view.paintDraft` is set, render the in-progress stroke on top of committed `signal.states` (paint: fill range with `bitState`; erase: propagate-left preview per step). The canvas must redraw on every `paintDraft` change so drags feel instant without touching undo history.

### `renderBitSignal.ts`

Renders a single bit signal row. Inputs: `ctx`, `signal: Signal`, `rowY: number` (logical top of row), `cellWidth: number`, `rowHeight: number`.

**Trace y positions (logical):**
```
Y_HIGH = rowY + TRACE_PADDING
Y_LOW  = rowY + rowHeight - TRACE_PADDING
Y_MID  = rowY + rowHeight / 2
```

**State-to-Y mapping:**
- `'1'` → `Y_HIGH`
- `'0'` → `Y_LOW`
- `'z'` → `Y_MID`
- `'u'` → `Y_HIGH + 4` (slightly below high)
- `'d'` → `Y_LOW - 4` (slightly above low)
- `'x'` → special (see below)
- `'p'` → square wave: alternates Y_HIGH / Y_LOW each sub-step
- `'n'` → square wave starting at Y_LOW

**Algorithm for bit signal trace:**

```
ctx.beginPath();
let prevY = stateToY(signal.states[0]);
ctx.moveTo(0, prevY);

for each step i from 0 to totalSteps-1:
  x = i * cellWidth
  nextX = (i + 1) * cellWidth
  y = stateToY(signal.states[i])

  if y !== prevY (state transition):
    ctx.lineTo(x + TRANSITION_WIDTH/2, prevY)  // horizontal to midpoint
    ctx.lineTo(x + TRANSITION_WIDTH, y)         // diagonal to new level

  ctx.lineTo(nextX, y)  // horizontal for this step
  prevY = y

ctx.stroke()
```

**Special state rendering:**
- `'x'` (undefined): do not include in the main path. After the main trace, draw a filled rectangle between Y_HIGH and Y_LOW for those steps using a hatched `CanvasPattern` (diagonal lines). Also draw the top/bottom boundary lines.
- `'z'` (high-Z): draw mid-line with a slightly different color (e.g., `signal.color + '80'` for 50% opacity). Use dashed `setLineDash([4, 4])`.

**Clock states `'p'`/`'n'`:** Expand to alternating 0/1 within each step. A `'p'` state at step `i` means the step starts high and transitions low at mid-step. A `'n'` state starts low. Render as a square wave with vertical edges (no diagonal transition) at mid-step.

### `renderVectorSignal.ts`

Renders bus/vector segments. The "bus" shape for each segment:

```
For a segment from x1 to x2 (logical px):
  D = BUS_DIAGONAL (8px)

  Top path:    (x1, Y_MID) → (x1+D, Y_HIGH) → (x2-D, Y_HIGH) → (x2, Y_MID)
  Bottom path: (x1, Y_MID) → (x1+D, Y_LOW)  → (x2-D, Y_LOW)  → (x2, Y_MID)

  Fill with: segment.color ?? signal.fillColor ?? (signal.color + '30')
  Stroke with: signal.color

  Text: ctx.fillText(segment.value, (x1+x2)/2, Y_MID)
        constrain with maxWidth = x2 - x1 - D*2 - 8
        font-size ≈ rowHeight * 0.35
```

When a segment is very short (x2 - x1 < D * 3), skip the flat top/bottom and just draw the X shape (two diagonal lines crossing at mid).

### `hitTest.ts`

```typescript
export interface HitTestResult {
  signalId: string | null;
  signalType: 'bit' | 'vector' | 'group' | null;
  step: number | null;         // time step index (0-based)
  half: 'top' | 'bottom' | null;  // for bit signals: top = '1', bottom = '0'
  isLabelArea: boolean;        // true if click is in the label column
  annotationId: string | null; // if clicking an annotation handle
}

export function hitTest(
  canvasX: number,   // CSS pixels, relative to canvas top-left (NOT device pixels)
  canvasY: number,   // CSS pixels — caller passes e.offsetX/offsetY, do not multiply by devicePixelRatio
  diagram: DiagramState,
  view: ViewState,
): HitTestResult
```

- `canvasX/canvasY` are **CSS pixels** (e.g. `e.offsetX` / `e.offsetY`). The renderer scales the backing store by `devicePixelRatio`, but pointer coordinates and `hitTest` both stay in CSS pixels — never mix the two.
- Returns null signalId if click is outside all signal rows
- `half` is determined by whether canvasY is in the top or bottom half of the row
- For vector signals, `half` is always null

### Acceptance Criteria

- [ ] Bit signals render with correct high/low/Z/X traces
- [ ] Vector signals render with diagonal-ended bus shape and value label
- [ ] Clock (`p`/`n`) signals render as square waves
- [ ] Zoom in/out rescales everything correctly
- [ ] Scroll clips the rendering to visible area only (performance)
- [ ] X (undefined) state renders with hatched fill
- [ ] Z state renders as a dashed mid-line
- [ ] `hitTest()` returns correct signalId and step for any click position

---

## Track B — Signal Panel

**Can start:** Immediately after Phase 0
**Files owned:** `src/signalPanel/`
**Depends on:** Phase 0 only
**Exposes:** `<SignalPanel>` component

### Objective

The left panel showing signal names in rows that align with the waveform canvas. Supports add, rename, delete, reorder (drag), group management, and right-click context menu. The panel's vertical scroll must stay in sync with the canvas.

### File Structure

```
src/signalPanel/
  SignalPanel.tsx         ← Container, manages sync with canvas scroll
  SignalRow.tsx           ← One signal row (name + actions)
  GroupRow.tsx            ← Group header row
  SignalContextMenu.tsx   ← Right-click menu
  DragHandle.tsx          ← Drag-to-reorder handle
  InlineEditor.tsx        ← Double-click-to-rename input
  SignalPanel.module.css
  index.ts
```

### Layout

- Fixed width: `LABEL_WIDTH` (160px), not affected by zoom
- Row height must exactly match what the renderer uses: `signal.rowHeight * zoom` for signal rows, `GROUP_HEADER_HEIGHT * zoom` for group headers
- The panel's `scrollTop` must stay pixel-locked to the canvas vertical scroll (`view.scrollY`)

### Scroll sync (owned by Track H, implemented by Tracks A + B)

**Do not** pass `canvasScrollY` as a React prop — async state updates cause visible jitter when scrolling fast.

**Scroll model (read carefully — the two panes scroll differently):**
- The **canvas scrolls virtually**: it is a fixed-size element and the renderer offsets all drawing by `view.scrollX` / `view.scrollY`. There is no native scrollbar on the canvas; wheel/drag events are captured and translated into `setScroll` + a redraw.
- The **signal panel scrolls natively** via an `overflow-y` container, so it has a real `scrollTop`.
- `scrollSync` bridges the two: it writes the panel's `scrollTop` imperatively to match the canvas's virtual `scrollY`, and vice versa.

`AppLayout.tsx` creates a stable ref object and passes it to both panes:

```typescript
// src/shell/scrollSync.ts (Track H owns this file)
export interface ScrollSyncHandles {
  /** The signal panel's overflow-y scroll container (native scrollTop). */
  signalPanelEl: HTMLDivElement | null;
  /** Canvas → panel: write panel.scrollTop = y. Call inside rAF. */
  applyCanvasScrollY(y: number): void;
  /** Panel → canvas: update store scrollY + trigger redraw. Call inside rAF. */
  applyPanelScrollY(y: number): void;
}
```

- `WaveformCanvas` wheel handler: clamp `y` to `[0, maxScrollY]` (= total content height − viewport height), `store.setScroll(x, y)`, then `scrollSync.applyCanvasScrollY(y)` in the same `requestAnimationFrame` callback
- `SignalPanel` wheel/scroll on the label column: `scrollSync.applyPanelScrollY(panel.scrollTop)` (updates store + redraws canvas)
- `view.scrollY` remains the source of truth for export, hit-test, and annotation `viewBox`; the panel's DOM `scrollTop` is kept in sync imperatively
- There is **no `canvasScrollEl`** — the canvas has no native scroll container. Earlier drafts implied one; only `signalPanelEl` is a real DOM scroll element.

### `SignalPanel.tsx`

```tsx
interface SignalPanelProps {
  scrollSync: ScrollSyncHandles;
  panelScrollRef: RefObject<HTMLDivElement>;  // the overflow-y scroll container
}
```

- Renders a list of `SignalRow` or `GroupRow` for each item in `diagram.signals`
- Row heights are dynamic based on `signal.rowHeight` and current `view.zoom`
- "Add Signal" button at bottom (opens dropdown: Bit Signal / Vector Signal / Blank Row)
- The scroll container uses `overflow-y: auto` with scrollbar hidden; vertical position is driven by `scrollSync`, not by React props

### `SignalRow.tsx`

Each row contains:
- Left: a drag handle (`⠿` or similar icon) — drag initiates reorder
- Center: the signal name, truncated with ellipsis if too long
- Right: a `⋯` button that opens the context menu

**Double-click on name** → replace with `<InlineEditor>` input, commit on Enter or blur.

**Visual indicators:**
- Signal type badge: small colored pill (`BIT` / `BUS`)
- Color swatch: small circle showing `signal.color`, clicking opens a color picker (inline `<input type="color">` or a custom mini picker)
- Selected state: highlighted background when `signal.id` is in `view.activeSignalIds`

### `GroupRow.tsx`

- Shows a left bracket / triangle indicator
- Group name is editable (double-click)
- Collapse/expand button — calls store action to toggle `group.collapsed`
- When collapsed, child rows are hidden (panel and canvas must agree on what's visible)

### Drag-to-Reorder

Use the HTML5 Drag and Drop API or pointer events for drag reorder:
- Drag handle initiates drag
- Drop target highlights as user drags over other rows
- On drop: call `store.reorderSignals(newOrderIds)` with the updated flat order
- Groups can be reordered but their children move with them

### `SignalContextMenu.tsx`

Right-click (or `⋯` click) shows a positioned menu with:
- Rename
- Delete
- Duplicate
- Add signal above / below
- Add to group / Remove from group
- Properties (opens a modal with color picker, row height, etc.)
- Separator: signal-type-specific options (e.g., "Set all to 0", "Set all to 1" for bit signals)

### Acceptance Criteria

- [ ] Row heights match canvas exactly at all zoom levels
- [ ] Scroll stays pixel-locked with canvas during fast wheel/drag (no one-frame jitter)
- [ ] Double-click rename works; commits on Enter, cancels on Escape
- [ ] Drag reorder updates the store; canvas redraws correctly
- [ ] Right-click context menu shows correct options per signal type
- [ ] Groups collapse/expand, hiding child rows in both panel and canvas

---

## Track C — Drawing Tools Engine

**Can start:** Immediately after Phase 0
**Files owned:** `src/tools/`
**Depends on:** Phase 0 types; consumes `hitTest()` from Track A (but can stub it for independent development)
**Exposes:** `useToolHandler()` hook

### Objective

Handles all pointer interaction on the waveform canvas: painting bit states, erasing, rectangular selection, and the cursor (object select) tool. Acts as the intermediary between raw pointer events and store mutations.

### File Structure

```
src/tools/
  useToolHandler.ts      ← Main hook, dispatches to specific tool handlers
  paintTool.ts           ← Paint/draw tool logic
  eraseTool.ts           ← Erase tool logic
  selectTool.ts          ← Rectangular selection logic
  cursorTool.ts          ← Object selection (click on annotations)
  toolState.ts           ← Local ephemeral state (drag in progress, start pos, etc.)
  index.ts
```

### `useToolHandler.ts`

```typescript
export function useToolHandler(canvasRef: RefObject<HTMLCanvasElement>): {
  onPointerDown: (e: PointerEvent, hit: HitTestResult) => void;
  onPointerMove: (e: PointerEvent, hit: HitTestResult) => void;
  onPointerUp: (e: PointerEvent, hit: HitTestResult) => void;
  onContextMenu: (e: MouseEvent, hit: HitTestResult) => void;
}
```

The hook reads `view.selectedTool` from the store and delegates to the appropriate tool module.

### `paintTool.ts`

**Logic:**

```
onPointerDown(e, hit):
  if hit.signalId === null → return
  if hit.signalType !== 'bit' → return (TODO: vector editing)
  flushPendingCodeToDiagram()   // Track E: cancel debounce race (see Track E)

  determine targetState:
    if e.button === 2 (right click) → open state picker popover
    else if hit.half === 'top' → '1'
    else → '0'
    (override: if e.shiftKey → view.activeBitState)

  Begin drag: store.setPaintDraft({ signalId, startStep: hit.step, endStep: hit.step, bitState: targetState, mode: 'paint' })
  Set canvasRef.setPointerCapture(e.pointerId)

onPointerMove(e, hit):
  if not dragging → return
  if hit.signalId !== draft.signalId → return
  if hit.step === draft.endStep → return
  store.setPaintDraft({ ...draft, endStep: hit.step })   // no pushHistory — canvas redraws draft overlay

onPointerUp:
  Release pointer capture
  const { signalId, startStep, endStep, bitState } = draft
  store.setSignalStateRange(signalId, min(startStep,endStep), max(startStep,endStep), bitState)  // single history entry
  store.clearPaintDraft()
```

**Why draft + single commit:** Committing only on pointer up keeps undo at one step per stroke; updating `paintDraft` on move gives live feedback without flooding `history` (max 100 entries).

### `eraseTool.ts`

Same draft pattern as paint (`mode: 'erase'`). On pointer move, extend `paintDraft.endStep`; renderer previews propagate-left erase over the range. On pointer up, apply erase logic in one batched store action (new `eraseSignalStateRange` or loop inside a single `set` + `pushHistory`) — not per-step `eraseSignalState` calls during drag.

### `selectTool.ts`

- Pointer down: record start position
- Pointer move: draw a selection rectangle overlay (CSS-positioned div, not canvas)
- Pointer up: compute which (signalId, step) pairs fall within the rectangle; set `view.activeSignalIds` and store the step range in local state
- Ctrl+A: select all signals
- Delete key: erase all states in the selection

### Keyboard Shortcuts

Implement in `useToolHandler` via `useEffect` + `keydown` listener:

| Key | Action |
|---|---|
| `D` | Switch to Paint tool |
| `E` | Switch to Erase tool |
| `S` | Switch to Select tool |
| `Escape` | Cancel current operation / clear selection |
| `1` | Set active bit state to `'1'` |
| `0` | Set active bit state to `'0'` |
| `Z` | Set active bit state to `'z'` |
| `X` | Set active bit state to `'x'` |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Zoom fit |

### Acceptance Criteria

- [ ] Paint tool: click-drag paints a range of steps on a single signal
- [ ] Top-half click → `'1'`, bottom-half click → `'0'`
- [ ] Erase tool propagates the preceding state value
- [ ] State painting batches into one undo entry per drag operation
- [ ] Keyboard shortcuts all work
- [ ] All tool changes are reflected immediately in canvas (store triggers re-render)

---

## Track D — WaveDrom JSON Bridge

**Can start:** Immediately after Phase 0
**Files owned:** `src/wavedromBridge/`
**Depends on:** Phase 0 types only
**Exposes:** `toWavedromJSON()`, `fromWavedromJSON()`, `validateWavedromJSON()`

### Objective

Bidirectional conversion between the internal `DiagramState` and WaveDrom JSON format. This is purely data transformation — no UI, no React.

### File Structure

```
src/wavedromBridge/
  toWavedromJSON.ts       ← DiagramState → WaveDrom JSON object
  fromWavedromJSON.ts     ← WaveDrom JSON → DiagramState
  waveStringCodec.ts      ← Encode/decode wave strings (run-length)
  wdTypes.ts              ← TypeScript types for WaveDrom JSON schema
  validate.ts             ← JSON schema validation
  index.ts
```

### WaveDrom JSON Schema

```typescript
// src/wavedromBridge/wdTypes.ts

export interface WdSignal {
  name?: string;
  wave?: string;
  data?: string[];          // values for '=' segments
  node?: string;            // for annotation nodes
  period?: number;
  phase?: number;
  skin?: string;
  [key: string]: unknown;   // WaveDrom allows arbitrary extra fields
}

export type WdSignalEntry = WdSignal | WdGroup | {};  // {} = blank row

export type WdGroup = [string, ...WdSignalEntry[]];   // ['GroupName', sig1, sig2...]

export interface WdRoot {
  signal: WdSignalEntry[];
  config?: {
    hscale?: number;
    skin?: string;
    head?: { text?: string; tick?: number; every?: number };
    foot?: { text?: string; tock?: number; every?: number };
  };
  head?: { text?: string; tick?: number; every?: number };
  foot?: { text?: string; tock?: number; every?: number };
  edge?: string[];
}
```

### `waveStringCodec.ts`

**Decode** (WaveDrom wave string → array of BitState per step):

```typescript
export function decodeWaveString(wave: string): BitState[] {
  const states: BitState[] = [];
  let prev: BitState = '0';

  for (const char of wave) {
    switch (char) {
      case '.': states.push(prev); break;         // continue previous
      case '0': states.push('0'); prev = '0'; break;
      case '1': states.push('1'); prev = '1'; break;
      case 'x': case 'X': states.push('x'); prev = 'x'; break;
      case 'z': case 'Z': states.push('z'); prev = 'z'; break;
      case 'u': case 'U': states.push('u'); prev = 'u'; break;
      case 'd': case 'D': states.push('d'); prev = 'd'; break;
      case 'p': case 'P': states.push('p'); prev = 'p'; break;
      case 'n': case 'N': states.push('n'); prev = 'n'; break;
      case '=': case '2': case '3': case '4': case '5':
      case '6': case '7': case '8': case '9':
        // Vector segment markers — handled by fromWavedromJSON, not here
        states.push('0' as BitState); prev = '0'; break;
      case '|': break;  // gap / break — skip
      // ignore unknown chars
    }
  }

  return states;
}
```

**Encode** (array of BitState → WaveDrom wave string, run-length compressed):

```typescript
export function encodeWaveString(states: BitState[]): string {
  if (states.length === 0) return '';
  let wave = states[0];
  for (let i = 1; i < states.length; i++) {
    wave += states[i] === states[i - 1] ? '.' : states[i];
  }
  return wave;
}
```

### `fromWavedromJSON.ts`

```typescript
export function fromWavedromJSON(wd: WdRoot): DiagramState
```

Algorithm:
1. Parse `wd.config.hscale` → `config.hscale`
2. Walk `wd.signal` array recursively
   - Array entries that are `{}` → `spacer` signal
   - Array entries that are `WdGroup` (first element is string) → `SignalGroup`, recurse children
   - Array entries that are `WdSignal` with `wave`:
     - If wave contains `=` or `2-9` chars → type `'vector'`
     - Otherwise → type `'bit'`
3. For bit signals: decode `wave` string using `decodeWaveString`
4. For vector signals:
   - Walk the wave string to find segment boundaries (each non-`.` char starts a new segment)
   - Pull values from `signal.data` array in order for each `=` marker
   - Colored segments (`2`-`9`) use a predefined color palette
5. Determine `totalSteps` = max wave string length across all signals
6. Pad shorter wave strings to `totalSteps` with the last state
7. Parse head/foot from `wd.head` / `wd.config.head`

**Edge cases:**
- Missing `wave` field → treat as all-zero bit signal
- `data` array shorter than `=` segments → use empty string for missing
- Nested groups (recursion)
- Empty signal array → empty diagram

### `toWavedromJSON.ts`

```typescript
export function toWavedromJSON(diagram: DiagramState): WdRoot
```

Algorithm:
1. Walk `diagram.signals` recursively
   - `spacer` → `{}`
   - `SignalGroup` → `['GroupName', ...children]`
   - `bit` signal → `{ name, wave: encodeWaveString(states) }`
   - `vector` signal → `{ name, wave, data }` where `wave` uses `=` for each segment and `.` for continuation
2. Build `config` from `diagram.config`
3. Result: `{ signal, config }`

**For vector to wave string:**
```
wave = ''
data = []
for each step:
  find which segment covers this step
  if start of new segment: wave += '='; data.push(segment.value)
  else: wave += '.'
```

### `validate.ts`

```typescript
/** Returns null if valid, or an error message string */
export function validateWavedromJSON(json: unknown): string | null
```

Check:
- Is an object with a `signal` array
- `signal` array entries are objects, arrays (groups), or `{}`
- Wave strings only contain valid characters
- `config.hscale` is 1–4 if present

### Acceptance Criteria

- [ ] Round-trip: `toWavedromJSON(fromWavedromJSON(wd))` produces equivalent output for all official WaveDrom examples
- [ ] Run-length encoding: `"10101"` encodes to `"10101"`, `"11100"` encodes to `"1..00"`
- [ ] Groups round-trip correctly including nesting
- [ ] Vector signals with data array round-trip correctly
- [ ] Invalid JSON returns descriptive error from `validateWavedromJSON`

---

## Track E — Live Code Panel

**Can start:** After Track D is complete
**Files owned:** `src/codePanel/`
**Depends on:** Track D (`toWavedromJSON`, `fromWavedromJSON`, `validateWavedromJSON`)
**Exposes:** `<CodePanel>` component

### Objective

A split panel containing: (left) a CodeMirror JSON editor showing live WaveDrom JSON; (right) a read-only WaveDrom rendered preview using the official `wavedrom` library. Changes in the editor update the diagram; changes in the diagram update the editor. Includes a "Copy" button and a "Open in WaveDrom Editor" link.

### File Structure

```
src/codePanel/
  CodePanel.tsx           ← Container: editor + preview side by side
  CodeEditor.tsx          ← CodeMirror instance
  WavedromPreview.tsx     ← Live rendered preview using wavedrom lib
  useDiagramToCode.ts     ← Hook: diagram state → JSON string
  useCodeToDiagram.ts     ← Hook: JSON string → diagram state (debounced)
  CodePanel.module.css
  index.ts
```

### Sync Strategy

This is the trickiest part. Use a local state string for the editor value, and avoid infinite update loops:

```typescript
// In CodePanel.tsx

const diagram = useStore(s => s.diagram);
const loadDiagram = useStore(s => s.loadDiagram);

// Direction: diagram → editor
// Only update editor code when the diagram changes externally
// (i.e., not because the editor triggered the change)
const [code, setCode] = useState(() => stringify(toWavedromJSON(diagram)));
const isEditorDrivenRef = useRef(false);

useEffect(() => {
  if (!isEditorDrivenRef.current) {
    setCode(stringify(toWavedromJSON(diagram)));
  }
  isEditorDrivenRef.current = false;
}, [diagram]);

// Direction: editor → diagram
const applyCodeToDiagram = useCallback((newCode: string) => {
  const err = validateWavedromJSON(JSON.parse(newCode));
  if (err) return;  // show error indicator, don't update diagram
  isEditorDrivenRef.current = true;
  loadDiagram(fromWavedromJSON(JSON.parse(newCode)));
}, [loadDiagram]);

const debouncedApply = useDebouncedCallback(applyCodeToDiagram, 400);

const handleCodeChange = (newCode: string) => {
  setCode(newCode);
  debouncedApply(newCode);
};

/** Call from WaveformCanvas pointerdown / focus — prevents canvas edits being overwritten by a pending debounce */
export function flushPendingCodeToDiagram() {
  debouncedApply.flush();
}
```

Wire `flushPendingCodeToDiagram()` from Track C `onPointerDown` (and optionally when the canvas container receives focus). If the debounce helper has no `.flush()`, keep the latest pending string in a ref and call `applyCodeToDiagram` synchronously before any diagram mutation.

**Important:** When the editor is focused and the user is typing, do NOT update the editor content from diagram changes. Only sync editor → diagram.

### `CodeEditor.tsx`

```tsx
import { EditorView, keymap, ... } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { defaultKeymap, historyKeymap } from '@codemirror/commands';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  error: string | null;  // shown as red underline or status bar message
}
```

- Use CodeMirror 6's controlled component pattern (update editor when `code` prop changes, but only when the editor is not actively being edited)
- JSON syntax highlighting with `@codemirror/lang-json`
- Linting: show red squiggles when `validateWavedromJSON` returns an error
- Status bar below editor: "✓ Valid" in green, or the error message in red
- "Copy" button top-right: copies current editor content to clipboard
- "Open in WaveDrom Editor" button: `window.open('https://wavedrom.com/editor.html')` with the JSON pre-filled via URL (WaveDrom supports `?` query param with encoded JSON)

### `WavedromPreview.tsx`

```tsx
// Import the official WaveDrom library
import WaveDrom from 'wavedrom';

interface WavedromPreviewProps {
  code: string;  // The JSON string to render
}
```

- On each valid code change, call `WaveDrom.renderWaveElement(el, JSON.parse(code))`
- Wrap in a `<div>` with `overflow: auto` so large diagrams scroll
- Match the current theme (pass appropriate skin to WaveDrom)

### Acceptance Criteria

- [ ] Editor shows valid JSON immediately reflecting current diagram
- [ ] Typing valid JSON updates diagram after 400ms debounce
- [ ] Invalid JSON shows error indicator; diagram does not change
- [ ] Diagram changes from canvas interaction update editor immediately
- [ ] No infinite update loops under any interaction
- [ ] Painting on canvas within 400ms of typing does not revert the diagram to stale JSON
- [ ] WaveDrom preview renders and updates live
- [ ] Copy button works

---

## Track F — Annotation Layer

**Can start:** After Track A exports its coordinate utilities
**Files owned:** `src/annotations/`
**Depends on:** Track A coordinate utilities (`hitTest`, logical-to-canvas coordinate math)
**Exposes:** `<AnnotationLayer>` SVG overlay component

### Objective

An SVG layer, positioned absolutely over the waveform canvas, that renders and allows interaction with annotations: dependency arrows, time span markers, time markers (vertical lines), and text annotations.

### File Structure

```
src/annotations/
  AnnotationLayer.tsx       ← SVG overlay, renders all annotations
  ArrowAnnotation.tsx       ← Single arrow SVG element
  TimeSpanAnnotation.tsx    ← Time span bracket
  TimeMarkerAnnotation.tsx  ← Vertical line marker
  TextAnnotationEl.tsx      ← Text label
  useAnnotationTools.ts     ← Pointer event handling for annotation creation tools
  useSignalRowPositions.ts  ← Helper: maps signalId → Y center in canvas coords
  AnnotationLayer.module.css
  index.ts
```

### `AnnotationLayer.tsx`

```tsx
<svg
  style={{
    position: 'absolute',
    top: 0, left: 0,
    width: '100%', height: '100%',
    pointerEvents: 'none',  // pass through to canvas by default
    overflow: 'visible',
  }}
  viewBox={`${scrollX} ${scrollY} ${canvasWidth} ${canvasHeight}`}
>
  {annotations.map(a => renderAnnotation(a))}
  {/* Active creation overlay when arrow/timespan tool is active */}
</svg>
```

Using `viewBox` tied to scroll/zoom means the SVG coordinate system matches the canvas logical coordinate system.

### Coordinate Utilities Needed from Track A

Track F needs to know the Y center of each signal row in logical coordinates. Since both tracks derive this from the same signal list and constants, Track F should implement its own `getSignalRowY(signalId, signals): number` using the same tree-walk algorithm Track A uses.

```typescript
// Shared utility (can be in shared/ or duplicated):
export function getVisibleRows(
  signals: SignalOrGroup[],
  zoom: number,
): Array<{ id: string; y: number; height: number }>
```

### `ArrowAnnotation.tsx`

- Renders an SVG `<line>` with an arrowhead marker from (fromX, fromY) to (toX, toX)
- `fromX = (fromStep + 0.5) * CELL_WIDTH` (center of the step cell)
- `fromY = getSignalRowY(fromSignalId) + ROW_HEIGHT / 2`
- Use SVG `<defs><marker>` for the arrowhead
- If `label` is set, render `<text>` at midpoint of the line
- On hover: show drag handles at both endpoints (circles, `pointerEvents: 'all'`)
- Drag handles allow moving the annotation endpoints

### `TimeMarkerAnnotation.tsx`

- Renders a vertical `<line>` at `x = step * CELL_WIDTH`
- Spans full height of the diagram (from 0 to total rows height)
- Optional label at top
- On hover: show a horizontal drag handle; drag to reposition the step

### `TimeSpanAnnotation.tsx`

- Renders a horizontal bracket:
  ```
  |←————— label —————→|
  ```
  Two vertical tick marks at `startStep * CELL_WIDTH` and `endStep * CELL_WIDTH`,
  connected by a horizontal line at `row === 'top' ? -16 : totalHeight + 16`
- Label centered on the horizontal line
- Drag handles at both ends

### `TextAnnotationEl.tsx`

- `<foreignObject>` containing a `<div>` with the text
- Or a plain SVG `<text>` element
- On double-click: show an inline `<input>` for editing
- Draggable to reposition

### `useAnnotationTools.ts`

Handles the annotation creation tools (arrow, timespan, marker, text). When the active tool is one of these:
- Arrow tool: click-drag from one signal row to another; on release, create the annotation
- Timespan tool: click-drag horizontally; on release, create the annotation
- Marker tool: click to place a marker at the step
- Text tool: click to place a text annotation

### Acceptance Criteria

- [ ] All four annotation types render correctly
- [ ] Annotations remain aligned when zoom or scroll changes
- [ ] Arrow annotations track signal rows correctly
- [ ] Drag handles appear on hover and work for repositioning
- [ ] New annotations can be created with the respective tools
- [ ] Delete key removes selected annotation
- [ ] Annotations round-trip through save/load

---

## Track G — Export Engine

**Can start:** After Track A's `CanvasRenderer` is stable
**Files owned:** `src/exportEngine/`
**Depends on:** Track A `CanvasRenderer`
**Exposes:** `exportPNG()`, `exportSVG()`, `exportJPG()`, `exportWavedromJSON()`

### Objective

Export the current diagram to various formats. For image export, render the full diagram to an offscreen canvas at 1× zoom (or user-specified scale), including the signal label column. The export should not be clipped to the current scroll position.

### File Structure

```
src/exportEngine/
  exportImage.ts       ← PNG / JPG via offscreen canvas
  exportSVG.ts         ← SVG via serialization
  exportJSON.ts        ← WaveDrom JSON text export
  ExportDialog.tsx     ← Modal UI for export options
  index.ts
```

### `exportImage.ts`

```typescript
interface ImageExportOptions {
  format: 'png' | 'jpg';
  scale: number;       // 1, 2, or 3 (for 2× and 3× hi-res)
  background: string;  // color, e.g. '#1a1a1a' for dark theme
}

export async function exportImage(
  diagram: DiagramState,
  view: ViewState,
  options: ImageExportOptions,
): Promise<void>
```

Algorithm:
1. Calculate full diagram dimensions (all steps × all signal rows, unclipped)
2. Create an `OffscreenCanvas` of that size × `options.scale`
3. Instantiate `CanvasRenderer` with the offscreen canvas context
4. Call `renderer.draw()` with `zoom=1, scrollX=0, scrollY=0, hscale=diagram.config.hscale`
5. Draw the signal label panel on the left side of the canvas (re-implement simple label rendering here — just signal names in a white column)
6. Convert to blob: `offscreenCanvas.convertToBlob({ type: 'image/png' })` (or JPEG)
7. Save using `FileSaver.saveAs(blob, 'waveform.png')`

**Note:** `OffscreenCanvas` is well-supported but not in all environments. Fallback: use a regular `<canvas>` element temporarily appended to `document.body` with `visibility: hidden`.

### `exportSVG.ts`

```typescript
export function exportSVG(diagram: DiagramState, view: ViewState): void
```

Rather than using the Canvas API, build an SVG string manually:

1. Calculate dimensions
2. Open `<svg>` element with correct `width`/`height`/`viewBox`
3. Add `<defs>` for hatching pattern (for X state), arrowhead markers
4. Add a `<rect>` for background
5. For each signal row, emit SVG elements:
   - `<path>` for the signal trace (same logic as canvas renderer, but outputting SVG path `d` strings)
   - `<rect>` + `<text>` for vector segments
   - `<rect>` + hatch pattern for X states
6. Add annotation elements (arrows, markers, etc.)
7. Add signal labels on the left (`<text>` elements)
8. Serialize to string with `new XMLSerializer().serializeToString(svgEl)` or build the string manually
9. Save as `.svg` file

### `exportJSON.ts`

```typescript
export function exportWavedromJSON(diagram: DiagramState): void
```

- Call `toWavedromJSON(diagram)` from Track D
- Serialize with `JSON.stringify(result, null, 2)`
- Save as `.json` file

### `ExportDialog.tsx`

Modal dialog with options:
- Format selector: PNG / SVG / JPG / WaveDrom JSON
- Scale selector (for image): 1× / 2× / 3×
- Background color picker (for image)
- Export button

### Acceptance Criteria

- [ ] PNG export produces a correctly-sized image including signal labels
- [ ] Export is not clipped to scroll position
- [ ] 2× scale option doubles the pixel dimensions
- [ ] SVG export is valid, opens in a browser and in Inkscape/Illustrator
- [ ] JSON export produces valid WaveDrom JSON
- [ ] Export dialog shows appropriate options per format

---

## Track H — App Shell

**Can start:** Immediately after Phase 0
**Files owned:** `src/shell/`, `src/App.tsx`, `src/index.css`, `src/shared/theme.css`
**Depends on:** Phase 0 for store imports; integrates all other tracks' components
**Exposes:** The main app layout

### Objective

The overall application layout: title bar with menu, main toolbar, three-pane content area (signal panel | waveform canvas | optional code panel), status bar. Theme system. File operations (new, open, save). Keyboard shortcut coordination.

### File Structure

```
src/shell/
  AppLayout.tsx         ← Three-pane layout with resize handles
  MenuBar.tsx           ← File / Edit / View / Help menus
  Toolbar.tsx           ← Icon toolbar: tools, zoom, add signal, etc.
  StatusBar.tsx         ← Bottom bar: tool name, zoom %, signal count, dirty indicator
  FileOperations.ts     ← New/Open/Save logic using File System Access API
  ThemeProvider.tsx     ← Applies theme CSS class to document root
  useTheme.ts           ← Hook for theme toggling
  AboutDialog.tsx       ← About modal
  shell.module.css
  index.ts
```

### `AppLayout.tsx`

Three-pane horizontal layout:
```
┌─────────────┬────────────────────────────┬───────────────┐
│ Signal Panel│     Waveform Canvas         │  Code Panel   │
│  (160px)    │    (fills remaining)        │  (400px)      │
│  Track B    │    Track A + F              │  Track E      │
└─────────────┴────────────────────────────┴───────────────┘
```

- Signal panel: fixed 160px left
- Code panel: toggleable right panel, default 400px, resizable via drag handle
- Canvas fills the middle, gets any remaining width
- Use CSS flexbox or grid; panel widths stored in component state (not the store)
- Time axis (Track A) rendered above the canvas if `view.showTimeAxis`
- Create `scrollSync` handles (`src/shell/scrollSync.ts`) and pass to `<SignalPanel>` and `<WaveformCanvas>` — see Track B scroll sync section

### `MenuBar.tsx`

**File menu:**
- New (`Ctrl+N`): `store.clearAll()` with confirm if dirty
- Open (`Ctrl+O`): File System Access API `window.showOpenFilePicker({ types: [{ accept: {'application/json': ['.json', '.wp']} }] })`, load file, call `fromWavedromJSON`, `store.loadDiagram`
- Save (`Ctrl+S`): if `view.fileName` exists, save in-place; otherwise Save As
- Save As (`Ctrl+Shift+S`): `window.showSaveFilePicker`, write JSON
- Import WaveDrom JSON: same as Open but restricts to `.json`
- Export → PNG/SVG/JPG/WaveDrom JSON: opens Export dialog (Track G)
- Separator
- Recent files (use `localStorage` to store last 5 file handles)

**Edit menu:**
- Undo (`Ctrl+Z`)
- Redo (`Ctrl+Y`)
- Separator
- Clear all signals (with confirm)
- Select All (`Ctrl+A`)

**View menu:**
- Theme: Dark / Light (radio group)
- Separator
- Time Axis (checkbox, toggles `view.showTimeAxis`)
- Code Panel (checkbox, toggles `view.showCodePanel`)
- Separator
- Zoom In / Zoom Out / Zoom to Fit

**Help menu:**
- About WaveDrom GUI Editor
- WaveDrom Documentation (external link)
- Keyboard Shortcuts (opens a modal listing all shortcuts)

### `Toolbar.tsx`

Icon button groups (separated by dividers):

```
[Open] [Save]  |  [Undo] [Redo]  |  [Zoom-] [Zoom+] [ZoomFit]  |
[AddSignal ▾]  |  [state: 1] [state: 0] [state: Z] [state: X]
[paint] [erase] [select]  |  [arrow] [timespan] [marker] [text] [cursor]  |
Steps: [20] Sub-steps: [1]
```

- Active tool button is visually highlighted
- State buttons (1, 0, Z, X) set `view.activeBitState`
- Add Signal dropdown: Bit Signal / Vector Signal / Blank Row / Predefined Patterns ▸

### `FileOperations.ts`

```typescript
export async function openFile(): Promise<DiagramState | null>
export async function saveFile(diagram: DiagramState, handle?: FileSystemFileHandle): Promise<FileSystemFileHandle | null>
export function newFile(): void  // clear with confirm
```

Use the File System Access API with a fallback to `<input type="file">` for browsers that don't support it.

### Theme System

Define all colors as CSS custom properties on `:root[data-theme="dark"]` and `:root[data-theme="light"]` in `src/shared/theme.css`:

```css
:root[data-theme="dark"] {
  --bg-app: #1a1a1a;
  --bg-panel: #242424;
  --bg-canvas: #111111;
  --border: #333333;
  --text-primary: #e8e8e8;
  --text-secondary: #999999;
  --accent: #4A9EFF;
  --signal-default: #4A9EFF;
  --signal-high: var(--signal-default);
  --signal-x-fill: #ff6b6b40;
  --signal-x-stroke: #ff6b6b;
  --signal-z-stroke: #aaaaaa;
  --grid-line: #333333;
  --selection-fill: #4A9EFF20;
  --selection-stroke: #4A9EFF;
}

:root[data-theme="light"] {
  --bg-app: #f5f5f5;
  --bg-panel: #ffffff;
  --bg-canvas: #ffffff;
  --border: #e0e0e0;
  --text-primary: #1a1a1a;
  /* ... */
}
```

`ThemeProvider.tsx` reads `view.theme` from store and sets `document.documentElement.dataset.theme`.

### Status Bar

Shows (left to right):
- Active tool name
- Active bit state indicator
- Zoom level: "100%"
- Signal count: "5 signals"
- Step count: "20 steps"
- Dirty indicator: `●` if unsaved changes

### Acceptance Criteria

- [ ] Three-pane layout renders; code panel toggles open/closed
- [ ] All menu items function (New, Open, Save As, Export, Undo, Redo, View toggles)
- [ ] File open/save works in Chrome (File System Access API)
- [ ] File open/save falls back to download link in Firefox
- [ ] Dark and light themes apply correctly to all panels
- [ ] Status bar updates live with zoom, tool, and dirty state
- [ ] Toolbar tool selection highlights active tool
- [ ] "Dirty" indicator appears on unsaved changes, clears on save

---

## Track I — Predefined Signal Patterns

**Can start:** Immediately after Phase 0
**Files owned:** `src/patterns/`
**Depends on:** Phase 0 types only
**Exposes:** Pattern generators and `<PatternsMenu>` component

### Objective

A library of functions that generate `BitState[]` arrays for common digital signal patterns, and a UI menu for inserting them.

### File Structure

```
src/patterns/
  generators.ts        ← Pure functions: pattern name → BitState[]
  PatternsMenu.tsx     ← Submenu / modal for choosing and configuring a pattern
  index.ts
```

### `generators.ts`

Each generator takes a config object and `totalSteps: number`, returns `BitState[]`.

```typescript
/** Rising-edge clock: 1,0,1,0,1,0,... starting at step 0 (optionally offset by phase) */
export function clockPattern(opts: {
  totalSteps: number;
  period?: number;   // steps per full cycle, default 2
  phase?: number;    // 0.0–1.0 phase offset, default 0
  initialValue?: '0' | '1';
}): BitState[]

/** Binary counter on a vector signal — returns segments */
export function counterPattern(opts: {
  totalSteps: number;
  bits?: number;     // bit width (2–16), default 4
  format?: 'hex' | 'dec' | 'bin';
}): VectorSegment[]

/** Synchronous reset: high for first N steps, then low */
export function resetPattern(opts: {
  totalSteps: number;
  assertedSteps?: number;  // default 2
  activeHigh?: boolean;    // default true
}): BitState[]

/** Single pulse: low everywhere except steps start..end */
export function pulsePattern(opts: {
  totalSteps: number;
  startStep?: number;   // default 2
  endStep?: number;     // default 4
  activeHigh?: boolean; // default true
}): BitState[]

/** Strobe / enable: repeating pulse every N steps */
export function strobePattern(opts: {
  totalSteps: number;
  period?: number;   // default 4
  width?: number;    // pulse width in steps, default 1
}): BitState[]

/** PWM: fixed period, varying duty cycle */
export function pwmPattern(opts: {
  totalSteps: number;
  period?: number;        // default 4
  dutyCycle?: number;     // 0.0–1.0, default 0.5
}): BitState[]

/** Walking one: only one bit high at a time, shifts left */
export function walkingOnePattern(opts: {
  totalSteps: number;
  bits?: number;     // default 4
}): BitState[]

/** Walking zero: inverse of walking one */
export function walkingZeroPattern(opts: {
  totalSteps: number;
  bits?: number;
}): BitState[]

/** Bus idle: all segments show a neutral "IDLE" label */
export function busIdlePattern(opts: {
  totalSteps: number;
  idleLabel?: string;   // default 'IDLE'
}): VectorSegment[]

/** Alternating: 0,1,0,1,... with configurable start */
export function alternatingPattern(opts: {
  totalSteps: number;
  startHigh?: boolean;  // default true
}): BitState[]

/** Gray code counter on a vector signal */
export function grayCodePattern(opts: {
  totalSteps: number;
  bits?: number;      // default 4
  format?: 'hex' | 'dec' | 'bin' | 'gray';
}): VectorSegment[]
```

**Implementation note for vector patterns:** Functions returning `VectorSegment[]` need to auto-generate IDs for each segment (use `nanoid()`).

### `PatternsMenu.tsx`

A submenu or modal (accessible from toolbar "Add Signal" dropdown → "Predefined Signals ▶"):

- List of pattern names with icons
- Clicking a pattern shows a small configuration panel (period, bits, etc.) with live preview
- "Insert" button: calls `store.addSignal`, then applies the pattern to the new signal's states

The live preview inside the menu can be a simplified miniature SVG preview (not full canvas), just enough to show the wave shape.

### Acceptance Criteria

- [ ] All patterns produce arrays of the correct length (`totalSteps`)
- [ ] Clock pattern alternates correctly with any period/phase combination
- [ ] Counter pattern produces correct hex/dec/bin labels in segments
- [ ] Reset and pulse patterns produce correct step ranges
- [ ] Insert inserts a new signal with the pattern applied
- [ ] Pattern menu is accessible from the toolbar

---

## Integration Checkpoints

### Checkpoint 1 (Day 3–4): First Render

**Requires:** Phase 0 complete, Track A skeleton, Track B skeleton, Track H layout.

- App shell renders with three-pane layout
- Signal panel shows signal rows that match canvas row heights
- Canvas renders at least a flat line for each signal
- Add Signal button creates a new signal visible in both panels

### Checkpoint 2 (Week 2): Core Interaction

**Requires:** Track A solid, Track B solid, Track C complete.

- Paint tool draws 1/0 by clicking upper/lower half of a cell
- Drag paints a range with live preview; one undo step per stroke
- Erase tool works
- Undo/Redo works
- Zoom in/out and scroll work

### Checkpoint 3 (Week 3): WaveDrom Round-Trip

**Requires:** Track D complete, Track E complete.

- Code panel opens and shows valid WaveDrom JSON
- Editing the JSON updates the canvas
- Drawing on the canvas updates the JSON
- Official WaveDrom examples can be imported and displayed correctly

### Checkpoint 4 (Week 4): Annotations + Export

**Requires:** Track F complete, Track G complete.

- All four annotation types can be created and rendered
- PNG export produces a correct, full-size image
- SVG export opens correctly in a browser

### Checkpoint 5 (Week 5): Full Polish

**Requires:** Track H complete, Track I complete.

- All menu items work
- All keyboard shortcuts work
- All predefined patterns can be inserted
- Light and dark themes work consistently across all panels
- File open/save works

---

## Reference editor parity (target UX)

MVP scope in this plan covers the core loop; defer unless explicitly requested:

| Reference feature | This plan |
|-------------------|-----------|
| Paint / erase / select, bit state palette (1/0/Z/X/U/D) | Tracks C, H |
| Vector/bus signals, predefined patterns | Tracks A, I |
| Arrows, time span, marker, text annotations | Track F |
| Live WaveDrom JSON + preview | Tracks D, E |
| PNG / SVG / JPG / JSON export | Track G |
| Theme, time axis, zoom, undo/redo | Tracks A, H |
| VCD import/export | **Out of scope** |
| TXT / CSV tabular export | **Post-MVP** (Track G extension) |
| Load Example, Debug Panel | **Post-MVP** (shell polish) |
| Sub-steps control | Use `config.hscale` + clock `p`/`n` for now; dedicated sub-step UI later if needed |

---

## Notes for Agents

1. **Do not modify `src/shared/`** after Phase 0 locks the types — coordinate changes through the team first.
2. **Each track owns its CSS** — use CSS Modules (`*.module.css`) scoped to each directory. Do not add global CSS except in `src/index.css` and `src/shared/theme.css`.
3. **Coordinate constants are in `shared/constants.ts`** — never hardcode `40` (row height) or `160` (label width) directly; always import from constants.
4. **The signal tree can be nested** (groups inside groups). Every function that walks signals must handle nesting recursively.
5. **`totalSteps` must always match `states.length`** for every bit signal. The store's `setTotalSteps` action handles resizing; individual tracks must not resize arrays themselves.
6. **Test against official WaveDrom examples** available at [wavedrom.com/demo.html](https://wavedrom.com/demo.html) — these are the ground truth for import/export fidelity.
7. **Undo coverage is deliberate, not uniform.** Structural edits (add/remove/rename signal, paint/erase, set steps, clear, annotation add/remove) call `pushHistory`. "Live" property tweaks that fire continuously from a slider/picker (`updateSignalColor`, `setHscale`, `updateAnnotation`) intentionally do **not** snapshot, to avoid flooding the 100-entry stack while dragging. If a property edit should be undoable, push history on the *commit* (pointer-up / blur), not on every change event.
8. **Pixel conventions:** all geometry math is in logical pixels (zoom=1, hscale=1); convert to canvas pixels only at draw time. Pointer coordinates and `hitTest` use CSS pixels; only the canvas backing store is scaled by `devicePixelRatio`.
