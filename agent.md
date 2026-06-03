# WaveDrom GUI Editor — Maintainer Guide

This file replaces the old parallel-build spec, orchestrator prompt, and progress tracker. The app is **feature-complete for solo-desk timing diagrams**; use this doc for scope, WaveDrom parity, coding rules, and history.

## Documentation map

| Document | When to read |
|----------|--------------|
| [`README.md`](README.md) | Quick start, architecture, project layout |
| **This file** | Scope, WaveDrom checklist, implementation rules, build history |
| [`docs/wavedrom-ref/`](docs/wavedrom-ref/) | Vendored WaveJSON notes + upstream test fixtures |

---

## Product scope (solo desk)

**Target user:** one engineer at a desk editing timing diagrams next to RTL or specs.

**In scope**

- Client-only SPA: no API server, database, auth, or collaboration.
- **Source of truth:** WaveDrom-compatible JSON on disk (Open/Save); Git handles versioning and sharing.
- Core loop: visual canvas edit ↔ live JSON panel ↔ export PNG/SVG/JSON.
- Optional local helpers: `localStorage` crash-recovery draft, recent file *names*, bundled samples.

**Out of scope** (do not re-open without an explicit user story)

- `backend/`, Postgres/SQLite, team libraries, hosted storage.
- VCD import/export.
- Non-WaveDrom annotation overlay — removed; use WaveDrom `edge[]` tools.
- Register (`reg[]`) and logic (`assign[]`) diagram editing on canvas.
- Real-time collaboration.
- TXT/CSV export, Load Example gallery, Debug Panel.

**Deployment:** static `dist/` (`make build`, `make preview`, or internal nginx).

---

## Current status

| Area | Status |
|------|--------|
| MVP (canvas, tools, bridge, code panel, export, shell) | **Done** |
| Solo desk (draft recovery, golden tests) | **Done** |
| WaveDrom fidelity (head/foot, edges, bus data, timing, export parity) | **Done** |
| Phase 5 polish (shortcuts, edge UX, SVG smoke tests) | **Done** |

**Verify:** `make test` (175 tests) · `make check` (test + build) · `make dev` → http://localhost:5173

---

## WaveDrom feature checklist

Maps official WaveJSON / WaveDrom capabilities (see [`docs/wavedrom-ref/WaveJSON.md`](docs/wavedrom-ref/WaveJSON.md) and the [tutorial](http://wavedrom.com/tutorial.html)) to this editor. Status keys: **Yes** = usable in GUI today; **Bridge** = import/export JSON only; **Partial** = incomplete; **No** = not implemented; **N/A** = different diagram type (not timing).

Last reviewed 2026-06-03.

### Diagram kinds (root object)

| Feature | WaveDrom | This editor | Notes |
|---------|----------|-------------|-------|
| Timing diagrams (`signal[]`) | Yes | **Yes** | Core product |
| Register / bit-field (`reg[]`) | Yes | **N/A** | Render-only via `wavedrom` npm if ever needed; no canvas editor |
| Logic circuits (`assign[]`) | Yes | **N/A** | Same |
| Mixed roots in one file | Yes | **N/A** | We only edit `signal` diagrams |

### Signal list structure

| Feature | WaveDrom | This editor | Notes |
|---------|----------|-------------|-------|
| Signal `name` (label column) | Yes | **Yes** | — |
| Nested groups `["Group", …]` | Yes | **Yes** | Collapse/expand in panel |
| Blank row `{}` (spacer) | Yes | **Yes** | Add “Blank” in UI |
| Signal reorder (drag) | Editor | **Yes** | Signal panel DnD |

### Wave string (`wave`) — per-cycle characters

| Char | Meaning (WaveDrom) | Decode | Canvas render | Paint tool |
|------|-------------------|--------|---------------|------------|
| `0` `1` | Low / high | Yes | Yes | **Yes** (toggle / set) |
| `.` | Continue previous | Yes | Yes | Via drag ranges |
| `x` | Unknown | Yes | Yes | Toolbar → set `x` |
| `z` | High-Z | Yes | Yes | Set mode |
| `u` `d` | Weak pull-up/down | Yes | **Yes** (dashed/lighter stroke) | Set mode |
| `p` `n` | Clock (+ / − edge) | Yes | Yes | Set / patterns |
| `P` `N` | Clock with arrow | Yes | **Yes** (arrow glyph canvas + export) | `P`/`N` keys + toggle |
| `=` `2`–`9` | Bus value + color | Yes | Yes (vector lanes) | **Yes** (paint tool + color swatches) |
| `\|` | Gap over previous | Yes | Yes (`drawStepGap`) | Low |

### Bus / vector lanes (`data` + `=`/`2`–`9`)

| Feature | WaveDrom | This editor | Notes |
|---------|----------|-------------|-------|
| Import vector wave + `data[]` labels | Yes | **Yes** | — |
| Export vector + labels | Yes | **Yes** | `busDataRoundTrip.test.ts` |
| Canvas paint / segment editor | Editor | **Yes** | Paint drag on bus rows; `VectorSegmentEditor` in panel |
| Per-segment colors (`2`–`9`) | Yes | **Yes** | Toolbar swatches + segment editor |
| Multi-word `data` (string or array) | Yes | **Bridge** | — |

### Per-signal fields (besides `wave`)

| Field | WaveDrom | This editor | Notes |
|-------|----------|-------------|-------|
| `data[]` — value **labels** on bus slots | Yes | **Yes** | Panel editor + paint label field |
| `period` — cycles per step | Yes | **Yes** | `SignalTimingBar` + per-lane column width on canvas |
| `phase` — horizontal shift | Yes | **Yes** | `SignalTimingBar` + `laneTiming` / render |
| `node` — anchor letters for `edge` | Yes | **Yes** | Tools + optional **ABC** toggle |
| `skin` on signal | Ignored | **No** | Low |

### Global `config` and header/footer

| Field | WaveDrom | This editor | Notes |
|-------|----------|-------------|-------|
| `config.hscale` | Yes | **Yes** | Toolbar number input; fractional values (e.g. `1.5`) |
| `config.skin` | Yes | **No** | Low (app themes replace for solo desk) |
| `head.text` + `tick` + `every` | Yes | **Yes** | `HeadFootFields` + canvas render |
| `foot.text` + `tock` + `every` | Yes | **Yes** | Same |
| Root-level `head` / `foot` (not only in `config`) | Yes | **Bridge** | Import merges into `config` |

> [!TIP]
> “Labels” in WaveDrom usually means **bus `data` labels** (text on colored blocks) or **head/foot figure text**, not arbitrary canvas stickers. Use WaveDrom `edge[]` tools for dependency arrows and span labels.

### Dependency arrows (`edge[]`)

| Feature | WaveDrom | This editor | Notes |
|---------|----------|-------------|-------|
| `edge: ["a->b label", …]` | Yes | **Partial** | Arrow + timespan tools; status bar list + delete |
| Arrow shapes `-`, `\|`, `~`, `/`, `#` | Yes | **Yes** | Sequential routing; toolbar shape preset + status edit |
| Import `edge` from JSON | Yes | **Yes** | — |
| Export `edge` to JSON | Yes | **Yes** | — |
| Live placement preview | Editor | **Yes** | `EdgeToolOverlay` — dashed path, span band, anchor badges |

Upstream example: `docs/wavedrom-ref/upstream-tests/signal-arcs.json5`.

### Editor / UX (visual canvas, WaveDrom-safe)

| Feature | WaveDrom editor | This editor | Notes |
|---------|-----------------|-------------|-------|
| Live JSON panel | Yes | **Yes** | — |
| Undo / redo | — | **Yes** | — |
| Open / Save file | Yes | **Yes** | — |
| Export PNG / SVG | CLI / editor | **Yes** | Includes edges |
| Patterns (clock, pulse, …) | Partial | **Yes** | More patterns optional |
| Step count editor | Yes | **Yes** | `DiagramStepsControl` in shell header |
| Sub-cycle / compressed steps | Yes | **No** | Deferred — `docs/wavedrom-ref/SUBCYCLE.md`; validator rejects `<`/`>` |
| Rename signal inline | Yes | **Yes** | — |
| Select + delete signals | Yes | **Yes** | Del: step erase vs row delete (confirm multi) |
| Keyboard shortcut sheet | — | **Yes** | `?` in toolbar → `ShortcutHelp` |
| Collapsible WaveDrom preview | Yes | **Yes** | Code panel **Preview** (default on); bundled `wavedrom` npm |

### Suggested next work

1. **Sub-cycle wave syntax** — spike only if needed; see `docs/wavedrom-ref/SUBCYCLE.md`.
2. **Upstream pixel parity** — extend `upstreamSvgGolden.test.ts` beyond structural smoke.
3. **Edge UX** — optional drag mid-point for `~` curves.
4. **Compare split** — canvas vs WaveDrom preview side-by-side (medium effort).

### Reference files for WaveDrom work

| Path | Role |
|------|------|
| `docs/wavedrom-ref/WaveJSON.md` | Vendored schema notes |
| `docs/wavedrom-ref/upstream-tests/` | Upstream JSON5 examples |
| `public/golden/` | Project round-trip fixtures |
| `src/wavedromBridge/` | Import/export implementation |
| `src/renderer/EdgeToolOverlay.tsx` | Edge tool live preview |
| `src/tools/useEdgeTools.ts` | Arrow / timespan placement |
| `src/wavedromBridge/renderWavedromSvg.ts` | Vitest upstream SVG smoke |
| `src/shell/ShortcutHelp.tsx` | Keyboard shortcut modal |
| `docs/wavedrom-ref/SUBCYCLE.md` | Sub-cycle syntax notes (deferred) |

---

## Repository layout

```
src/
  shared/           types, Zustand store, theme, constants
  renderer/         canvas draw, hit test, edge layout
  wavedromBridge/   WaveDrom JSON import/export (only JSON syntax layer)
  tools/            pointer tools → store actions
  signalPanel/      left label column
  codePanel/        CodeMirror JSON editor + WaveDrom preview
  shell/            toolbar, layout, file I/O, soloDesk draft recovery
  exportEngine/     PNG / SVG / JSON export
  patterns/         predefined waveform templates
  App.tsx           root composition
```

See [`README.md`](README.md) for data flow, WaveDrom field mapping, and project layout.

---

## Tech stack

| Concern | Choice |
|---------|--------|
| Build | Vite 5 + React 18 + TypeScript 5 (strict) |
| State | Zustand 4 + Immer |
| Waveforms | Canvas 2D API |
| Code editor | CodeMirror 6 |
| WaveDrom preview | `wavedrom` npm (read-only pane; may need `optimizeDeps.include` in Vite) |
| Tests | Vitest + happy-dom |
| Styling | CSS Modules per folder + `shared/theme.css` |

---

## Critical implementation rules

These patterns keep the UI responsive. Breaking them causes visible regressions.

| Area | Do | Don't |
|------|----|-------|
| Undo history | `current(state.diagram)` from Immer inside `pushHistory` | `structuredClone` on every mutation |
| Label panel scroll | Shared DOM refs + `requestAnimationFrame`; write `scrollTop` directly | Pipe scroll through React state (jitter) |
| Paint drag | Update `view.paintDraft` during move; one history push on pointer up | `setSignalState` per move or commit with no draft |
| Code ↔ canvas | `flushPendingCodeToDiagram()` on canvas pointer down before paint | Let debounced JSON overwrite a paint stroke |
| Constants | Import from `shared/constants.ts` | Hardcode row height (`40`), cell width, etc. |
| hitTest | CSS pixels (`offsetX`/`offsetY`) | Mix device pixels into step math |
| Signal tree | Recurse into nested groups everywhere | Assume flat signal list |
| `totalSteps` | Resize via store `setTotalSteps` only | Mutate `states.length` ad hoc in UI code |
| Geometry | Logical pixels (zoom=1, hscale=1); scale at draw time | Scale coordinates in hit-test math inconsistently |
| WaveDrom JSON | Parse/emit only in `wavedromBridge/` | Read `wave` strings in renderer or tools |

### Undo coverage

Structural edits (add/remove signal, paint/erase, step count, edges) call `pushHistory`. Continuous tweaks from sliders/pickers (`updateSignalColor`, `setHscale`) intentionally **do not** snapshot on every tick — push history on commit (pointer-up / blur) if undo is needed.

### CSS conventions

- Each folder owns its `*.module.css`.
- Global CSS only in `src/index.css` and `src/shared/theme.css`.

### Ground truth for import/export

Test against official WaveDrom examples ([wavedrom.com/demo.html](https://wavedrom.com/demo.html)) and fixtures in `docs/wavedrom-ref/upstream-tests/` and `public/golden/`.

---

## Where to change things

| Task | Start here |
|------|------------|
| New signal field or diagram shape | `shared/types.ts` → `shared/store/` → `wavedromBridge/` |
| Wave character / gap / glitch semantics | `wavedromBridge/waveStringCodec.ts`, `clockWave.ts` |
| How a lane draws | `renderer/renderBitSignal.ts`, `renderVectorSignal.ts` |
| Mouse → step index | `renderer/hitTest.ts`, `renderer/laneTiming.ts` |
| Dependency arrows | `renderer/edgeLayout.ts`, `tools/useEdgeTools.ts` |
| JSON editor sync | `codePanel/codeSync.ts`, `useCodeToDiagram.ts`, `flushRegistry.ts` |
| Toolbar / file menus | `shell/Toolbar.tsx`, `shell/FileOperations.ts` |
| Export image | `exportEngine/exportCanvas.ts`, `exportSVG.ts` |

---

## Build history

The project was built in parallel Cursor tracks (Phase 0 → tracks A–I → integration checkpoints CP0–CP5), then phased fidelity work. Commit-level detail lives in **git log**; milestone summary:

| Phase | Delivered |
|-------|-----------|
| **CP0–CP5** | Shared store, canvas renderer, tools, WaveDrom bridge, code panel, export, shell, patterns |
| **Phase 2 — Solo desk** | `soloDesk/` draft recovery, golden round-trip tests, toggle paint, pointer marker |
| **Phase 3 — Fidelity** | `edge[]` + `node`, head/foot UI, bus labels, edge overlay, period/phase, upstream goldens |
| **Phase 4 — Polish** | Normalize on load, error boundary, AMBA samples, pipe gaps, bus paint on canvas, edge tools |
| **Phase 5 — Backlog** | Bus data parity, P/N arrow glyphs, edge path routing, shortcuts, preview default, SVG smoke |

---

## For AI coding agents

When extending or fixing this repo:

1. Read [`README.md`](README.md) and the **WaveDrom feature checklist** in this file before large changes.
2. Stay within **solo desk scope** unless the user explicitly expands it.
3. Prefer minimal diffs; match existing module boundaries and naming.
4. Run `make test` and `make check` (or `npm test` + `npm run build`) before declaring done.
5. Changes to `shared/types.ts` or `shared/store/` usually require matching updates in `wavedromBridge/` and tests.
6. Only commit when the user asks.
