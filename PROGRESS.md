# WaveDrom GUI Editor — Progress

Orchestrator tracking: [`ORCHESTRATOR_PROMPT.md`](ORCHESTRATOR_PROMPT.md) · Spec: [`agent.md`](agent.md) · Capability checklist: [`docs/FUTURE_FEATURES.md`](docs/FUTURE_FEATURES.md)

## Checkpoints CP0–CP5 (initial build)

| CP | Status | Commit | Tests |
|----|--------|--------|-------|
| 0  | done   | f9e0a87 | 4/4 |
| 1  | done   | 2957d40 | 44/44 |
| 2  | done   | 8c5fc90 | 50/50 |
| 3  | done   | 8c5fc90 | 50/50 |
| 4  | done   | 8c5fc90 | 50/50 |
| 5  | done   | 8c5fc90 | 50/50 |

## Phase 2 — Solo desk (fork A)

| Track | Status | Commit | Notes |
|-------|--------|--------|-------|
| SOLO-J | done | 9307f59 | `src/shell/soloDesk/` — draft autosave, restore, beforeunload, recent names |
| SOLO-K | done | 9307f59 | `public/golden/` + `goldenRoundTrip.test.ts` (5 fixtures) |
| SOLO-L | done | 9307f59 | Vector add disabled until bus canvas edit (later re-enabled in P3-VEC) |
| Integrate | done | 9307f59 | `App.tsx`, `FileOperations`, toggle paint, pointer marker — 64/64 tests |

## Phase 3 — WaveDrom fidelity

| Track | Status | Commit | Notes |
|-------|--------|--------|-------|
| P3-STORE | done | 3e60c42 | `DiagramState.edges`, `Signal.node`, bridge round-trip |
| P3-HF | done | d4b45cd | Head/foot render + `HeadFootFields` in shell; hitTest aligned |
| P3-GOLD | done | d4b45cd | `upstreamGolden.test.ts` (timing import smoke) |
| P3-DATA | done | 2b20416 | `VectorSegmentEditor` in signal panel |
| P3-EDGE | done | 323a5ee | `EdgeOverlay` SVG + `edgeLayout.ts` |
| P3-VEC | done | 323a5ee | Bus add re-enabled in toolbar |
| P3-TIMING | done | 2b20416 | `SignalTimingBar` phase/period; `timingRoundTrip.test.ts` |
| Docs | done | 223dac2 | `docs/wavedrom-ref/`, `docs/FUTURE_FEATURES.md` |

## Phase 4 — Polish

| Track | Status | Commit | Notes |
|-------|--------|--------|-------|
| P4-STABILITY | done | e46e0ce | `normalizeDiagram`, `safeStorage`, `AppErrorBoundary`, happy-dom tests |
| P4-UX | done | 2039635 | Steps control, panel/canvas alignment, toggle p/x/z, themes HC |
| P4-AMBA | done | 2039635 | `public/samples/amba-*.json` — APB/AHB/AXI templates |
| P4-RENDER | done | 2cdc479 | Pipe-gap decode/render, lane timing helpers, export edge paths |
| P4-FIDELITY | done | 19bdb21 | Bus colors, fractional `hscale`, per-lane period/phase on canvas, bus paint on canvas |
| P4-EDGE-UX | done | 9b8e8f9 | Arrow/timespan tools, `EdgeToolOverlay` live preview, status edge chips |
| P4-EXPORT | done | — | Bus `data[]` parity (`vectorSegments`, `busDataRoundTrip.test.ts`) |

## Phase 5 — Fidelity & UX backlog

| Track | Status | Notes |
|-------|--------|-------|
| P5-BUS-DATA | done | Golden round-trip; idle/`x` no spurious `data[]` |
| P5-PN-ARROW | done | `P`/`N` `BitState`, codec, canvas + export SVG arrowheads |
| P5-UD-STYLE | done | Dashed/lighter stroke for weak `u`/`d` |
| P5-EDGE-PATH | done | Sequential edge interpreter (`edgeLayout` ↔ upstream `arc-shape`) |
| P5-EDGE-UI | done | Shape presets, ABC anchor toggle, status-bar edge inspector |
| P5-SELECT-DEL | done | Del: step erase vs row `removeSignal` (confirm multi) |
| P5-SHORTCUTS | done | `ShortcutHelp` modal (`?` toolbar) |
| P5-PREVIEW | done | Code panel preview default on; Eye toggle retained |
| P5-SUBCYCLE | deferred | `docs/wavedrom-ref/SUBCYCLE.md`; validate rejects `<`/`>` in wave |
| P5-SVG-GOLDEN | done | `upstreamSvgGolden.test.ts` + `renderWavedromSvg.ts` |

**Verify:** `npm test` — **148/148** tests · `npm run build` OK (uncommitted)

## Known gaps (detail in FUTURE_FEATURES.md)

- Sub-cycle wave syntax (`<5|>`, etc.) — documented/deferred; import blocked in validator
- Upstream SVG — structural smoke only, not pixel parity vs official renderer
- Edge mid-point drag for `~` curves — optional future UX
