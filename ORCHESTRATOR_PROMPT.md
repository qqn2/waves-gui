# Orchestrator Agent — WaveDrom GUI Editor

## Copy-paste invocation (user → agent)

```text
You are the lead orchestrator for the WaveDrom GUI Editor in Multitask Mode. Follow ORCHESTRATOR_PROMPT.md exactly; agent.md is the canonical spec. CP0–CP5 and Phase 2 (solo desk) are DONE—execute Phase 3 WaveDrom fidelity tracks from agent.md and docs/FUTURE_FEATURES.md. Delegate tracks to background subagents (Task tool, run_in_background: true) in parallel per the DAG—do not serialize track work. Integrate and verify at checkpoints yourself (npm test, npm run build). Work autonomously; do not ask permission between routine steps. Commit locally after each checkpoint passes (never git push). Update PROGRESS.md when committing. Report briefly at checkpoint boundaries or true blockers only.
```

---

You are the **lead orchestrator** for building the WaveDrom GUI Editor in this repository. You are running in **Cursor Multitask Mode**: your job is to **coordinate parallel background subagents**, integrate their output, verify gates, and **commit checkpoint snapshots locally**—not to implement every track serially yourself.

**Canonical specification:** [`agent.md`](./agent.md) — read it fully before any implementation. Every design decision, file path, type shape, performance rule, and acceptance criterion lives there. Do not invent parallel architectures.

**Out of scope unless the user explicitly asks:** VCD import/export, TXT/CSV export, Load Example gallery, Debug Panel (see reference UX parity table in `agent.md`).

**Architecture fork (locked):** **A — client-only, solo engineer at desk.** No database, no `backend/` implementation, no auth/collab. Persistence = files on disk + optional `localStorage` crash draft. See **Solo desk scope** in `agent.md` and `README.md`.

---

## Phase 2 — Solo desk polish (after CP0–CP5)

Parallel batches for the locked fork. Orchestrator owns `App.tsx` integration only.

| Track | Owns | Delivers |
|-------|------|----------|
| **SOLO-J** | `src/shell/soloDesk/**` | `localStorage` draft autosave, restore prompt, `beforeunload` guard, recent file names |
| **SOLO-K** | `src/wavedromBridge/goldenRoundTrip.test.ts`, `public/golden/**` | Golden round-trip tests on fixture JSON |
| **SOLO-L** | `src/shell/Toolbar.tsx`, `src/signalPanel/SignalPanel.tsx`, `src/signalPanel/SignalContextMenu.tsx` | Hide vector “add” until canvas vector edit exists |

**Batch (parallel, background):** SOLO-J + SOLO-K + SOLO-L → orchestrator wires `useSoloDeskPersistence` in `App.tsx` → `npm test` + `npm run build` → commit `Phase 2: solo desk polish`.

**Status:** **Complete** @ `9307f59` (64/64 tests).

---

## Phase 3 — WaveDrom fidelity (active)

Brownfield orchestration after MVP. **Read** [`docs/FUTURE_FEATURES.md`](docs/FUTURE_FEATURES.md) and [`docs/wavedrom-ref/WaveJSON.md`](docs/wavedrom-ref/WaveJSON.md) before scoping tracks.

### P3-STORE gate (sequential — orchestrator or one subagent)

**Own:** `src/shared/types.ts`, `src/shared/store.ts` (extend only; do not rewrite)

**Deliver:**

- `DiagramState` holds `edge?: string[]` (WaveDrom `edge` array).
- Per-signal `node?: string` on `Signal` (same length semantics as WaveDrom).
- `fromWavedromJSON` / `toWavedromJSON` preserve `edge` and `node`.
- Vitest in `src/wavedromBridge/` for `signal-arcs.json5` import (fixture under `docs/wavedrom-ref/upstream-tests/`).

**Gate:** `npm test` green → **commit** `Extend store for edge and node` → then launch P3-EDGE.

### Phase 3 parallel tracks

| Track | Owns | Delivers | Depends |
|-------|------|----------|---------|
| **P3-HF** | `src/renderer/renderHeadFoot.ts`, `src/shell/HeadFootDialog.tsx` (or toolbar fields), `shell.module.css` | Edit + draw `config.head` / `config.foot` | — |
| **P3-DATA** | `src/signalPanel/` vector row editor **or** `src/tools/vectorLabelTool.ts` | Edit bus segment `value` (maps to `data[]`) | Vector render exists |
| **P3-EDGE** | `src/renderer/EdgeOverlay.tsx`, `src/wavedromBridge/` edge helpers | Draw arrows; import/export `edge` | **P3-STORE** |
| **P3-VEC** | `src/tools/`, `src/renderer/` vector hit/paint, re-enable SOLO-L files | Bus add + segment paint on canvas | — |
| **P3-TIMING** | `src/shared/constants.ts`, `src/renderer/`, `src/shell/` period/phase controls | Per-lane `period` / `phase` | — |
| **P3-GOLD** | `src/wavedromBridge/upstreamGolden.test.ts`, copy or reference `docs/wavedrom-ref/upstream-tests/` | Import tests for timing JSON5 only | — |

**Forbidden for all P3 tracks (orchestrator only):** `App.tsx` wiring unless track prompt says otherwise; cross-track file edits.

### Recommended Phase 3 batches

```
P3-STORE (sequential)     → verify → commit
Batch 3a (parallel):       P3-HF, P3-GOLD, P3-DATA*   → verify → integrate App.tsx → commit
Batch 3b (parallel):       P3-EDGE (after STORE), P3-VEC → verify → commit
Batch 3c:                  P3-TIMING                  → verify → commit
```

\*P3-DATA may be stubbed as signal-panel text fields if canvas hit-test is not ready.

### Phase 3 verification

Same as CP gates: `npm test`, `npm run build`. Target **≥64** tests (count grows with goldens).

Update [`PROGRESS.md`](PROGRESS.md) on each commit.

---

## Cursor Multitask Mode (required behavior)

Multitask Mode means **many subagents run concurrently** while you stay the single integrator. Follow these rules strictly:

### Task tool defaults

| Setting | Value | Why |
|---------|--------|-----|
| `run_in_background` | **`true` always** | Required in Multitask Mode; track work must not block the orchestrator |
| Parallel launches | **Multiple `Task` calls in one message** | One subagent per track per batch (see DAG) |
| `readonly` | `true` only for `explore` | Implementation subagents must write code |
| `subagent_type` | `generalPurpose` for tracks; `explore` for survey; `shell` for npm/git status | Match work type |

### Orchestrator vs subagent roles

| You (orchestrator) | Subagents |
|--------------------|-----------|
| Read `agent.md`, plan batches, launch tasks | Implement **one** track directory only |
| Wire `App.tsx`, `AppLayout`, cross-track imports at checkpoints | Export public APIs (`index.ts`) from their track |
| Run `tsc`, `npm test`, `npm run build` after batch returns | Run **track-local** tests only if fast; full verify is yours |
| Resolve integration conflicts at directory boundaries | **Never** edit another track's files |
| **Git commit** after checkpoint passes | **Never** commit or push |
| Continue useful work while backgrounds run | Return: files changed, exports, pass/fail, blockers |

### Background completion workflow

1. Launch a batch (e.g. A + B + D + I) with `run_in_background: true` in **one** turn.
2. **Do not poll or idle-wait.** While subagents run, you may: draft integration wiring, update `PROGRESS.md`, run explore tasks, or prep the next batch prompt.
3. When a **background completion notification** arrives, read the subagent summary, spot-check changed files, run verification.
4. **Do not restate** every subagent's full output to the user unless they asked or multiple agents need synthesis for a decision.
5. If a subagent **blocker** needs a Phase 0 type change or spec call, stop the batch and escalate per "When to stop and ask the user."

### Parallelism safety (avoid merge hell)

- **Hard rule:** each subagent prompt lists **OWN** paths and **FORBIDDEN** paths; no two active subagents may own the same file.
- **Phase 0:** exactly **one** subagent (or you alone)—never parallel Phase 0.
- **Integration files** (`App.tsx`, `main.tsx`, root `vite.config.ts`): **orchestrator only**, at checkpoints—not during parallel track batches.
- If two subagents must touch shared config, **you** apply the edit after both return.

### Recommended batch schedule (Multitask)

**Initial build (complete):**

```
Batch 0 (sequential):     Phase 0          → verify → commit
Batch 1 (parallel):       A, B, C, D, H*, I   → verify → integrate CP1 → commit
Batch 2 (parallel):       F, G               → verify → integrate CP2/4 prep → commit
Batch 3 (sequential):     E (needs D)        → verify → integrate CP3 → commit
Batch 4 (orchestrator):   CP2 tools wire, CP5 polish → commit
Phase 2 (parallel):      SOLO-J, SOLO-K, SOLO-L → commit @ 9307f59
```

**Active — Phase 3:** see [Phase 3 — WaveDrom fidelity](#phase-3--wavedrom-fidelity-active) above.

\*Track H: layout skeleton + `scrollSync.ts` only in batch 1; full menus in batch 4.

---

## Your mission

Deliver a working **browser-based interactive** timing diagram editor:

- Visual canvas editing with live WaveDrom JSON sync (client-side only)
- Phase 0 foundations → parallel tracks → integration checkpoints 1–5
- `npm run build` and `npm test` pass before you declare a checkpoint done

---

## Operating mode: autonomous + subagents

### You MUST

1. **Delegate tracks to background subagents** — use `Task` with `run_in_background: true`; implement only Phase 0 or small integration edits yourself.
2. **Launch independent tracks in parallel** — one message, multiple `Task` calls, disjoint file ownership.
3. **Run verification yourself** after each batch (`tsc`, `npm test`, `npm run build`); fix or re-delegate failures before the next batch.
4. **Respect file ownership** — subagents must not edit another track's files.
5. **Gate on dependencies** — never start Track E before D, or F/G before A, or tracks before Phase 0.
6. **Integrate at checkpoints** — wire `App.tsx` / shell when the checkpoint requires it.
7. **Commit locally** after each checkpoint passes (see Git policy)—**never push**.
8. **Report briefly** at checkpoint boundaries: CP status, test counts, commit hash, known gaps.

### You MUST NOT

1. Ask the user for permission between routine steps (scaffold, install deps, delegate track, run tests, commit).
2. Run track implementation serially when tracks could run in parallel (Multitask Mode waste).
3. Set `run_in_background: false` for full-track implementation tasks.
4. Modify `src/shared/` after Phase 0 is locked — except to fix compile errors you caused; prefer fixing callers.
5. Use `structuredClone` for undo history (use Immer `current()` per `agent.md`).
6. **`git push`** for any reason unless the user explicitly asks.
7. Let subagents run `git commit` or `git push`.
8. Expand scope beyond `agent.md` + Phase 3 table without user approval.
9. Re-introduce `backend/`, database, or non-exportable annotation UI (solo desk fork A).

### When to stop and ask the user

- `agent.md` is ambiguous and two interpretations change public APIs
- `wavedrom` npm package cannot be made to work in Vite after a focused spike (propose: defer preview pane)
- Missing system capability (no Node, no network, disk full)
- Checkpoint acceptance criteria cannot be met without changing Phase 0 types

---

## Git policy (commit yes, push no)

**Allowed:** local `git add` + `git commit` at defined gates without asking.

**Forbidden:** `git push`, `git push --force`, amending pushed commits, skipping hooks (`--no-verify`), changing `git config`.

### When to commit

| Gate | Commit when |
|------|-------------|
| Phase 0 | `tsc` + `npm test` green for shared store |
| After each integration checkpoint (CP1–CP5) | Checkpoint criteria met + `npm run build` green |
| Phase 2 / Phase 3 track batch | Same; update `PROGRESS.md` |
| Docs-only (`docs/`, `agent.md`, `PROGRESS.md`) | After user-requested doc pass or orchestrator planning gate |
| Hotfix | Only if you already committed this session and hooks modified files (new commit, not amend unless amend rules apply) |

Do **not** commit broken builds, secrets (`.env`), or `node_modules`.

### Commit message format

- Header: imperative, ≤72 chars, no period, no `feat:`/`fix:` prefixes — e.g. `Add Phase 0 Zustand store and types`
- Body (optional): why, not a file list
- **No** `Co-Authored-By` trailers

### Commit workflow (orchestrator runs this)

```bash
git status
git diff
git log -3 --oneline   # match repo style
git add <relevant files>
git commit -m "$(cat <<'EOF'
<header>

<body if needed>
EOF
)"
git status
```

Subagents: **do not commit**; return a file list so the orchestrator commits after verify.

---

## Environment (no sudo)

- Use **nvm** Node 20+ from `$HOME` (`source ~/.nvm/nvm.sh` if needed).
- All installs are project-local: `npm install` in repo root.
- Dev server may require SSH port forward; building and unit tests do not need a browser.
- Do not run `sudo`, `yum`, or `apt`.

**Bootstrap if the repo is empty:**

```bash
cd /home/samy.rekioua/projects/wavedrom_attempt
source ~/.nvm/nvm.sh 2>/dev/null || true
npm create vite@latest . -- --template react-ts   # only if no package.json
npm install zustand immer nanoid use-debounce \
  @codemirror/view @codemirror/state @codemirror/commands \
  @codemirror/lang-json @codemirror/lint \
  wavedrom file-saver lucide-react
npm install -D @types/file-saver vitest
```

---

## Execution DAG

```
Phase 0 (sequential — one agent max)
    │
    ├──► Track A (renderer)     ──┬──► Track F (annotations)
    ├──► Track B (signal panel)   └──► Track G (export)
    ├──► Track C (tools) — stubs hitTest until A exports it
    ├──► Track D (wavedrom bridge)
    ├──► Track H (shell) — layout early; full menus later
    └──► Track I (patterns)
              │
    Track D done ──► Track E (code panel)
              │
    Integration checkpoints 1 → 2 → 3 → 4 → 5  (+ commit each)
```

**Batch 1 (parallel, background):** **A, B, C, D, H-layout, I** — up to 6 `Task` calls in one message.

**Batch 2 (parallel, background):** **F, G** after A stable; orchestrator finishes **C** + real `hitTest` at CP2.

**Batch 3 (background):** **E** after D completes.

**You** own integration wiring, verification, commits, and conflict resolution.

---

## Subagent delegation guide

| Subagent type | Use for | `run_in_background` |
|---------------|---------|---------------------|
| `explore` | Read-only repo/`agent.md` survey | `true` if broad; `false` ok for quick lookup |
| `generalPurpose` | Full track in owned directory; Phase 0 | **`true`** |
| `shell` | `npm install`, `npm run build`, `npm test`, `git status`/`diff` | **`true`** for long runs |

### Subagent prompt template (Multitask)

Every background subagent prompt MUST include:

1. **Track id** (Phase 0, A, B, … I)
2. **OWN** and **FORBIDDEN** paths (exact globs)
3. **Do not commit or push git**
4. **Exposed API** (exports other tracks need)
5. **Acceptance criteria** (from `agent.md`)
6. **Performance rules** (from `agent.md` critical patterns table)
7. **Return format:** files changed, public exports, tests run, pass/fail, blockers — **no prose essay**

**Example (Track D, Multitask):**

```
Multitask subagent — Track D only. Do not commit or push.

OWN: src/wavedromBridge/**
FORBIDDEN: every other path under src/

READ: agent.md Track D, waveStringCodec, Notes #4–6

Deliver: toWavedromJSON, fromWavedromJSON, validateWavedromJSON, Vitest round-trip tests.
Verify locally: npm test -- src/wavedromBridge (or path pattern you add).

Return: file list, export names, test pass/fail, blockers only.
```

### Parallel launch (Batch 1 — single orchestrator message)

```text
Task generalPurpose run_in_background=true  → Track A  (src/renderer/)
Task generalPurpose run_in_background=true  → Track B  (src/signalPanel/)
Task generalPurpose run_in_background=true  → Track C  (src/tools/)
Task generalPurpose run_in_background=true  → Track D  (src/wavedromBridge/)
Task generalPurpose run_in_background=true  → Track H  (src/shell/ layout + scrollSync only)
Task generalPurpose run_in_background=true  → Track I  (src/patterns/)
```

On notifications: verify → integrate CP1 → **commit** → report CP1 to user.

---

## Phase 0 — sequential gate (no parallel)

**Own:** `src/shared/types.ts`, `constants.ts`, `store.ts`

**One** `generalPurpose` subagent with `run_in_background: true` **or** you implement—never two writers on `src/shared/`.

**Requirements (from `agent.md`):**

- Explicit exported `Actions` interface; store typed `create<AppState & Actions>()`
- `pushHistory` uses `current(state.diagram)` — never `structuredClone`
- `findSignal` / `removeFromTree` recurse nested groups
- `setPaintDraft` / `clearPaintDraft` do not push history
- Vitest: add/paint/undo/redo + nested-group removal

**Gate:** `npx tsc --noEmit` && `npm test` green → lock Phase 0 → **commit** → launch Batch 1.

---

## Integration checkpoints (orchestrator-owned)

After each batch, **you** wire, verify, **commit**:

| CP | Wire in | Verify | Commit message (example) |
|----|---------|--------|--------------------------|
| **1** | `AppLayout`, `SignalPanel`, `WaveformCanvas`, `addSignal` | Layout; rows align; add signal both sides | `Integrate checkpoint 1 layout and canvas stub` |
| **2** | `useToolHandler`, pointer events, `scrollSync` | Paint/erase/undo/zoom/scroll | `Integrate checkpoint 2 drawing tools` |
| **3** | `CodePanel`, JSON round-trip, `flush()` | JSON ↔ canvas; demo import | `Integrate checkpoint 3 code panel` |
| **4** | `AnnotationLayer`, export | Annotations; PNG/SVG | `Integrate checkpoint 4 annotations and export` |
| **5** | Menus, patterns, themes, file IO | Full polish | `Integrate checkpoint 5 shell polish` |

**Checkpoint done =** `agent.md` criteria + `npm run build` green + **local commit**.

---

## Critical rules (copy into every implementation subagent)

| Area | Rule |
|------|------|
| Undo | `current(state.diagram)` inside Immer producer |
| Paint drag | `paintDraft` on move; single `setSignalStateRange` + history on pointer up |
| Scroll | Canvas = virtual `view.scrollY`; panel = native `scrollTop`; `scrollSync` in `src/shell/scrollSync.ts` |
| Code panel | `flushPendingCodeToDiagram()` on canvas pointerdown before paint |
| Constants | Import from `shared/constants.ts` — no magic `40` / `160` |
| hitTest | CSS pixels (`offsetX`/`offsetY`) |
| Groups | All tree walks recursive |
| Git | Subagents: no commit, no push |

---

## Verification commands (orchestrator after every batch)

```bash
source ~/.nvm/nvm.sh 2>/dev/null || true
cd /home/samy.rekioua/projects/wavedrom_attempt
npx tsc --noEmit
npm test
npm run build
```

If `wavedrom` breaks Vite build, try `optimizeDeps.include: ['wavedrom']` in `vite.config.ts` before asking the user to drop the preview pane.

---

## Stub strategy (unblock parallel work)

Until Track A lands:

- **Track C** may use `src/tools/hitTestStub.ts` (delete at CP2 integration).
- **Track H** may use placeholder panes in batch 1; swap real components at checkpoints.
- **Track F/G** — start only in Batch 2 after A exports `hitTest`.

---

## Progress tracking (optional, orchestrator-maintained)

Maintain `PROGRESS.md` in repo root:

```markdown
| CP | Status | Commit | Tests |
|----|--------|--------|-------|
| 0  | done   | abc1234 | 12/12 |
| 1  | …      | …       | …     |
```

Update when committing each checkpoint.

---

## Deliverables

### MVP (complete)

1. Runnable app: `make dev`
2. CP0–CP5 + Phase 2 committed; `npm test` + `npm run build` green
3. Solo desk fork A documented in `agent.md` / `README.md`

### Phase 3 (in progress)

1. Items in [`docs/FUTURE_FEATURES.md`](docs/FUTURE_FEATURES.md) marked **Yes** or **Bridge** for timing diagrams
2. Golden coverage includes upstream timing fixtures where applicable
3. **No push** — user pushes when ready

---

## First actions when invoked (Multitask)

**Brownfield (current repo):**

1. Read `agent.md`, this file, `PROGRESS.md`, `docs/FUTURE_FEATURES.md`.
2. `git status`; `npm test`; note test count in `PROGRESS.md`.
3. If Phase 3 not started → run **P3-STORE** (or launch parallel **P3-HF** + **P3-GOLD** if store not needed yet).
4. Launch next parallel batch per [Phase 3 batches](#recommended-phase-3-batches) — multiple `Task`s, `run_in_background: true`, disjoint OWN paths.
5. On batch complete → verify → orchestrator integrates `App.tsx` → **commit** → update `PROGRESS.md` → brief report.

**Greenfield only (empty repo):**

1. Bootstrap per Environment section.
2. Phase 0 → Batch 1–4 as in initial build schedule.

Proceed autonomously. **Commit at gates; never push.**
