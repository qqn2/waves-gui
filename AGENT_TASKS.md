# waves-gui — Agent Task Brief

## Pre-prompt

You are an expert TypeScript/React engineer working on **waves-gui**, a browser-based WaveDrom timing diagram editor. Before doing anything else, read the following files in order:

1. [`README.md`](./README.md) — architecture overview, data flow, WaveDrom field mapping
2. [`agent.md`](./agent.md) — scope rules, WaveDrom feature checklist, coding rules, undo/CSS conventions

### Non-negotiable rules (from `agent.md`)
- **Solo-desk scope only** — no backend, no auth, no collaboration, no VCD, no `reg[]`/`assign[]` diagram editing.
- All WaveDrom JSON parsing/emitting must live exclusively in `src/wavedromBridge/`.
- Use `current(state.diagram)` from Immer inside `pushHistory`, never `structuredClone`.
- Import constants (row height, cell width, etc.) from `src/shared/constants.ts` — never hardcode.
- Signal tree traversal must recurse into nested groups everywhere (never assume a flat list).
- CSS: each folder owns its `*.module.css`; global CSS only in `src/index.css` and `src/shared/theme.css`.
- After every change run `make test` (or `npm test`) and confirm 0 failures before declaring done.
- Do not commit; do not add any backend, database, or server code.

### How to verify your work
```bash
make test     # must pass (currently ~175 tests)
make check    # test + production build
make dev      # dev server at http://localhost:5173
```

---

## Flagged Issues to Fix

Work through these in priority order. Each item includes the exact file(s) to start in, what is wrong, and what done looks like.

---

### 🔴 Priority 1 — Stubs (explicitly broken)

#### 1. Duplicate Signal

**Problem:** The right-click context menu shows a "Duplicate" button, but it does nothing. The `onDuplicate` handler in [`SignalPanel.tsx`](./src/signalPanel/SignalPanel.tsx) just calls `closeMenu()`.

```tsx
// SignalContextMenu.tsx ~L85 — the button title is a dead giveaway:
title="Requires store.duplicateSignal (not implemented)"
```

**Fix:**
1. Add a `duplicateSignal(id: string): void` action to `src/shared/store/index.ts` that:
   - Calls `pushHistory()` before mutating.
   - Deep-clones the target signal (generate a new `id` with `crypto.randomUUID()`).
   - Inserts the clone immediately after the original in the same parent group (or top-level list).
   - Works correctly for both `bit` and `vector` signal types (copy `states[]` and `segments[]`).
   - Works when the signal is nested inside a `SignalGroup`.
2. Wire `onDuplicate` in `SignalPanel.tsx` to call `duplicateSignal(menuSignalId)`.
3. Remove the `title="Requires store.duplicateSignal (not implemented)"` comment.
4. Add a unit test in `src/shared/store.test.ts` covering: bit signal duplication, vector signal duplication, and duplication of a signal inside a group.

**Done when:** Right-clicking a signal → Duplicate creates an identical copy below it; undo reverts it; `make test` passes.

---

### 🟢 Priority 2 — High-value, low-effort extensions

#### 2. Copy PNG / SVG to Clipboard

**Problem:** Export only writes to a file. There is no way to copy the current diagram as an image to the clipboard (a very common workflow: paste into a doc/slide).

**Fix:**
1. In `src/exportEngine/ExportDialog.tsx`, add two new buttons: **"Copy PNG"** and **"Copy SVG"**.
2. For PNG: call the existing `buildExportCanvas()` (or equivalent), call `canvas.toBlob('image/png')`, then `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`.
3. For SVG: call the existing SVG export function, then `navigator.clipboard.writeText(svgString)`.
4. Show a brief "Copied!" toast/label on success (a simple `setTimeout`-cleared state flag is fine).
5. Guard with `navigator.clipboard` availability check; disable buttons if not available (HTTPS/localhost required).

**Done when:** Clicking "Copy PNG" in the export dialog pastes a valid PNG into any image-accepting app.

---

#### 3. Recent Files in Toolbar

**Problem:** `agent.md` explicitly lists "recent file *names* in `localStorage`" as in-scope, and the solo-desk draft recovery infrastructure already uses `localStorage`. But the **toolbar File menu has no recent files section**.

**Fix:**
1. In `src/shell/FileOperations.ts` (or a new `src/shell/soloDesk/recentFiles.ts`), implement:
   - `pushRecentFile(name: string): void` — stores up to 5 file names in `localStorage` under key `waves-gui:recent-files`.
   - `getRecentFiles(): string[]` — reads and returns the list.
2. Call `pushRecentFile(fileName)` in the Save and Open flows.
3. In `src/shell/toolbar/ToolbarFileMenu.tsx`, render a "Recent" sub-section in the File menu. Since the app can't reopen files by path (no filesystem API for that), recent file names are display-only — clicking one shows a hint: `"Open the file manager and re-open: <filename>"` or just displays the names as a convenience reminder.
4. If `getRecentFiles()` returns an empty list, hide the section.

**Done when:** Save a file, close and reopen the tab, open File menu → recent file name appears.

---

#### 4. Signal Search / Filter

**Problem:** With more than ~10 signals, there is no way to find a signal by name in the left panel.

**Fix:**
1. Add a small search input at the top of `src/signalPanel/SignalPanel.tsx` (inside the scrollable area header, above the signal list).
2. Maintain a `filterText` local state string. When non-empty, only render signals whose `name` contains `filterText` (case-insensitive). Groups are shown only if they contain at least one matching child; spacers are hidden.
3. When `filterText` is non-empty, auto-expand all collapsed groups so matches are visible.
4. The input should have an `×` clear button when non-empty.
5. Filtering is view-only — it must not mutate `diagram.signals`.

**Done when:** Typing in the filter box narrows the visible signal list; clearing it restores all signals.

---

#### 5. Fit-to-Window Zoom

**Problem:** There is no single-click way to zoom the diagram so all signals and all steps are visible simultaneously.

**Fix:**
1. Add a **"Fit"** button to the zoom row in `src/shell/Toolbar.tsx` (between ZoomOut and the zoom % label, or after ZoomIn).
2. On click, compute:
   ```ts
   const canvasWidth  = /* current canvas element clientWidth */;
   const canvasHeight = /* current canvas element clientHeight */;
   const contentW = totalSteps * CELL_WIDTH * hscale;
   const contentH = totalContentHeight(buildRowLayout(signals));
   const zoom = Math.min(canvasWidth / contentW, canvasHeight / contentH, 4.0);
   ```
3. Call `setZoom(Math.max(0.25, zoom))` and reset `scrollX`/`scrollY` to 0.
4. The canvas ref is available via the existing `WaveformCanvas` component — thread it or read from a store-accessible ref.

**Done when:** Clicking "Fit" shows all signals and all steps without scrolling.

---

#### 6. Undo for Slider / Picker Commits

**Problem:** `agent.md` documents that continuous tweaks from sliders (`setHscale`, `setSignalPhase`, `setSignalPeriod`, `updateSignalColor`) do not push undo history on each tick — which is correct. But the "commit" path (blur/pointer-up) also does not push history, so these edits are **never undoable**.

**Fix:**
1. In `src/shell/SignalTimingBar.tsx`, call `pushHistory()` in the `onBlur` handler of the phase and period inputs (before applying the value, so the snapshot is the state before the commit).
2. In any color picker components that call `updateSignalColor`, call `pushHistory()` on `pointerup` / final `onChange` commit.
3. In `DiagramStepsControl.tsx` for `setHscale`, call `pushHistory()` on the `onBlur` of the hscale input.
4. `pushHistory()` is available via `useStore.getState().pushHistory()`.

**Done when:** Changing phase → pressing Tab → Ctrl+Z restores the previous phase value.

---

### 🟡 Priority 3 — Medium-effort extensions

#### 7. Insert / Delete Step Column

**Problem:** The only way to change diagram length is `DiagramStepsControl` (appends/truncates from the right). There is no way to insert a column at step N (shifting everything right) or delete a column at step N (shifting everything left).

**Fix:**
1. Add two store actions to `src/shared/store/index.ts`:
   - `insertStepAt(index: number): void` — calls `pushHistory()`, then for every signal inserts a `'.'` (hold) state at `index` in `states[]`, increments `totalSteps`, shifts `stepGaps` and `stepGlitches`, and shifts `VectorSegment.startStep`/`endStep` for segments whose start is ≥ `index`.
   - `deleteStepAt(index: number): void` — calls `pushHistory()`, removes state at `index`, shifts gaps/glitches, adjusts vector segments (shrink or remove if they collapse to zero width).
2. Expose these actions in the right-click context on the **time axis** (if shown), or as toolbar buttons that operate on the step under the pointer cursor.
3. Update `node` strings: shifting nodes is complex — for now, clear all `node` strings and `edges[]` when an insert/delete occurs (document this in a `// TODO` comment).

**Done when:** Right-clicking a column (or using a toolbar action) inserts/deletes a step; all signal states shift correctly; undo works.

---

#### 8. Selection Copy / Paste

**Problem:** The select tool selects signal rows + step ranges, but `Ctrl+C` / `Ctrl+V` do nothing.

**Fix:**
1. Define an internal clipboard shape (not the system clipboard):
   ```ts
   interface StepRangeClipboard {
     signals: Array<{ id: string; states: BitState[]; segments: VectorSegment[] }>;
     stepCount: number;
   }
   ```
   Store this in `ViewState` (not `DiagramState`, so it is not saved to file).
2. On `Ctrl+C` (when a step selection and at least one signal is active): copy the selected step range's `states` slice and the intersecting `segments` sub-range for each selected signal into the clipboard.
3. On `Ctrl+V`: paste at the current step cursor (use the selection start step, or step 0 if none). Call `pushHistory()` before applying.
4. Wire handlers in `src/tools/useToolHandler.ts` (already handles Ctrl+Z/Ctrl+Y).

**Done when:** Select a step range → Ctrl+C → move cursor → Ctrl+V pastes the waveform segment.

---

#### 9. Apply Pattern to Existing Signal

**Problem:** The Patterns menu always adds a **new** signal. You cannot apply a pattern (e.g., Clock, Counter) to the waveform of an already-existing signal.

**Fix:**
1. In `src/patterns/PatternsMenu.tsx`, add an **"Apply to selected signal"** button (shown only when `view.activeSignalIds.length === 1` and the selected signal type matches the pattern's `signalKind`).
2. On click: call `buildPattern(id, totalSteps, cfg)` and then call a new store action `applyPatternToSignal(signalId, result)` that:
   - Calls `pushHistory()`.
   - If the result is `BitState[]`, replaces the signal's `states`.
   - If the result is `VectorSegment[]`, replaces the signal's `segments`.
3. Filter the pattern list to only show patterns compatible with the selected signal's type.

**Done when:** Selecting a bit signal → opening Patterns → choosing Clock → "Apply to selected signal" replaces the signal's waveform with the clock pattern.

---

## Notes for the Agent

- Run `make test` after **every task** before moving to the next.
- If a task requires changes to `shared/types.ts`, also update `wavedromBridge/` (encode/decode) and add a round-trip test.
- Prefer small, focused PRs. Do not bundle unrelated changes.
- Do not change the undo/history architecture — `pushHistory()` + Immer `current()` is the established pattern.
- Do not add any new npm dependencies without explicit approval.
