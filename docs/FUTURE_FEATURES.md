# WaveDrom feature checklist (future GUI work)

This checklist maps **official WaveJSON / WaveDrom** capabilities (see `docs/wavedrom-ref/WaveJSON.md` and the [tutorial](http://wavedrom.com/tutorial.html)) to this **solo-desk timing editor**. Status keys: **Yes** = usable in GUI today; **Bridge** = import/export JSON only; **Partial** = incomplete; **No** = not implemented; **N/A** = different diagram type (not timing).

Last reviewed against commit `9307f59` and upstream docs fetched 2026-05-29.

## Diagram kinds (root object)

| Feature | WaveDrom | This editor | Notes |
|---------|----------|-------------|-------|
| Timing diagrams (`signal[]`) | Yes | **Yes** | Core product |
| Register / bit-field (`reg[]`) | Yes | **N/A** | Render-only via `wavedrom` npm if ever needed; no canvas editor |
| Logic circuits (`assign[]`) | Yes | **N/A** | Same |
| Mixed roots in one file | Yes | **N/A** | We only edit `signal` diagrams |

## Signal list structure

| Feature | WaveDrom | This editor | Priority |
|---------|----------|-------------|----------|
| Signal `name` (label column) | Yes | **Yes** | — |
| Nested groups `["Group", …]` | Yes | **Yes** | Collapse/expand in panel |
| Blank row `{}` (spacer) | Yes | **Yes** | Add “Blank” in UI |
| Signal reorder (drag) | Editor | **Yes** | Signal panel DnD |

## Wave string (`wave`) — per-cycle characters

| Char | Meaning (WaveDrom) | Decode | Canvas render | Paint tool |
|------|-------------------|--------|---------------|------------|
| `0` `1` | Low / high | Yes | Yes | **Yes** (toggle / set) |
| `.` | Continue previous | Yes | Yes | Via drag ranges |
| `x` | Unknown | Yes | Yes | Toolbar Z/X modes → set `x` |
| `z` | High-Z | Yes | Yes | Set mode |
| `u` `d` | Weak pull-up/down | Yes | Partial styling | Set mode |
| `p` `n` | Clock (+ / − edge) | Yes | Yes (dedicated draw) | Set / pattern |
| `P` `N` | Clock with arrow | Yes | **Partial** (decoded as `p`/`n`) | Low |
| `=` `2`–`9` | Bus value + color | Vector path | Vector row | **No** (use JSON) |
| `\|` | Gap over previous | Spec | **No** | Low |

## Bus / vector lanes (`data` + `=`/`2`–`9`)

| Feature | WaveDrom | This editor | Priority |
|---------|----------|-------------|----------|
| Import vector wave + `data[]` labels | Yes | **Bridge** | — |
| Export vector + labels | Yes | **Bridge** | — |
| Canvas paint / segment editor | Editor | **No** | **High** — re-enable when ready |
| Per-segment colors (`2`–`9`) | Yes | **Bridge** | Medium |
| Multi-word `data` (string or array) | Yes | **Bridge** | — |

## Per-signal fields (besides `wave`)

| Field | WaveDrom | This editor | Priority |
|-------|----------|-------------|----------|
| `data[]` — value **labels** on bus slots | Yes | **Bridge** | **High** for bus UX (edit label text on segment) |
| `period` — cycles per step | Yes | **No** | Medium — stretch column width per lane |
| `phase` — horizontal shift | Yes | **Bridge** | Medium — clock alignment UI |
| `node` — anchor letters for `edge` | Yes | **No** | **High** if implementing `edge` |
| `skin` on signal | Ignored | **No** | Low |

## Global `config` and header/footer

| Field | WaveDrom | This editor | Priority |
|-------|----------|-------------|----------|
| `config.hscale` | Yes | **Yes** | Store + export; zoom is separate view zoom |
| `config.skin` | Yes | **No** | Low (theme CSS replaces for solo desk) |
| `head.text` + `tick` + `every` | Yes | **Bridge** | **High** — title + tick marks above diagram |
| `foot.text` + `tock` + `every` | Yes | **Bridge** | **High** — figure caption below |
| Root-level `head` / `foot` (not only in `config`) | Yes | **Bridge** | Import merges into `config` |

> [!TIP]
> “Labels” in WaveDrom usually means **bus `data` labels** (hex/text on colored blocks) or **head/foot figure text**, not arbitrary canvas stickers. Our old annotation layer (arrows, text) was **not** WaveDrom-exportable and stays out of scope unless mapped to `edge` / official fields.

## Dependency arrows (`edge[]`)

| Feature | WaveDrom | This editor | Priority |
|---------|----------|-------------|----------|
| `edge: ["a~>b label", …]` | Yes | **No** | **High** — needs `node` on signals + SVG overlay or WaveDrom render |
| Arrow shapes `-`, `\|`, `~`, `/`, `#` | Yes | **No** | With `edge` |
| Import `edge` from JSON | Yes | **No** (dropped on import) | **High** |
| Export `edge` to JSON | Yes | **No** | **High** |

See upstream example: `docs/wavedrom-ref/upstream-tests/signal-arcs.json5`.

## Editor / UX (visual canvas, WaveDrom-safe)

| Feature | WaveDrom editor | This editor | Priority |
|---------|-----------------|-------------|----------|
| Live JSON panel | Yes | **Yes** | — |
| Undo / redo | — | **Yes** | — |
| Open / Save file | Yes | **Yes** | — |
| Export PNG / SVG | CLI / editor | **Yes** | — |
| Patterns (clock, pulse, …) | Partial | **Yes** | More patterns optional |
| Step count editor | Yes | **Partial** | Medium — UI for `totalSteps` |
| Sub-steps / `period` | Yes | **No** | Medium |
| Rename signal inline | Yes | **Yes** | — |
| Select + delete signals | Yes | **Partial** | Medium |
| Keyboard shortcut sheet | — | **No** | Low |
| Collapsible WaveDrom preview | Yes | **No** (removed for space) | Low — optional “render check” |

## Explicitly out of scope (solo desk fork A)

| Item | Reason |
|------|--------|
| `backend/`, database, auth | Locked in `agent.md` |
| VCD import/export | `agent.md` / orchestrator |
| Non-WaveDrom annotation layer in main UI | Does not round-trip |
| `reg` / `assign` diagram editing | Different product surface |
| Real-time collaboration | Solo desk |

## Suggested implementation order

1. **Head / foot** — small form + render text/ticks on canvas (data already in `DiagramState.config`).
2. **Bus labels (`data`)** — vector segment value editor (panel or click on bus).
3. **`edge` + `node`** — parse/store `edge[]`; place nodes from context menu; render via WaveDrom overlay or custom SVG matching spec.
4. **Vector canvas tools** — re-enable bus add + segment paint (SOLO-L hide).
5. **`period` / `phase`** UI — align with `signal-step4.json5` upstream test.
6. **Golden expansion** — add `upstream-tests/*.json5` to CI as import targets (timing only).

## Related files in this repo

| Path | Role |
|------|------|
| `docs/wavedrom-ref/WaveJSON.md` | Vendored schema notes |
| `docs/wavedrom-ref/upstream-tests/` | Upstream JSON5 examples |
| `public/golden/` | Project round-trip fixtures |
| `src/wavedromBridge/` | Import/export implementation |
