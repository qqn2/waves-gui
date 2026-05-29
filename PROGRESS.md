# WaveDrom GUI Editor — Progress

Orchestrator tracking: [`ORCHESTRATOR_PROMPT.md`](ORCHESTRATOR_PROMPT.md) · Spec: [`agent.md`](agent.md) · Future work: [`docs/FUTURE_FEATURES.md`](docs/FUTURE_FEATURES.md)

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
| SOLO-L | done | 9307f59 | Vector add disabled until bus canvas edit |
| Integrate | done | 9307f59 | `App.tsx`, `FileOperations`, toggle paint, pointer marker — **64/64** tests, build OK |

## Phase 3 — WaveDrom fidelity (active)

| Track | Status | Commit | Notes |
|-------|--------|--------|-------|
| P3-STORE | done | 3e60c42 | `DiagramState.edges`, `Signal.node`, bridge round-trip |
| P3-HF | done | d4b45cd | Head/foot render + `HeadFootFields` in shell; hitTest aligned |
| P3-GOLD | done | d4b45cd | `upstreamGolden.test.ts` (5 tests) |
| P3-DATA | pending | — | Bus `data` label editor |
| P3-EDGE | done | 323a5ee | `EdgeOverlay` SVG + `edgeLayout.ts` |
| P3-VEC | done | 323a5ee | Bus add re-enabled; segment paint still JSON-only |
| P3-TIMING | pending | — | `period` / `phase` UI |
| Docs | done | 223dac2 | `docs/wavedrom-ref/`, `docs/FUTURE_FEATURES.md` |

## Known gaps (see FUTURE_FEATURES.md)

- Bus labels (`data`) — bridge only, no GUI edit (P3-DATA)
- Edge drawing — simplified SVG (not full WaveDrom path grammar)
- Vector segment paint — add bus in UI; edit values in JSON (P3-TIMING / segment tool later)
