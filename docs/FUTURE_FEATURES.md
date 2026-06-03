# WaveDrom feature checklist (future GUI work)

This checklist maps **official WaveJSON / WaveDrom** capabilities (see `docs/wavedrom-ref/WaveJSON.md` and the [tutorial](http://wavedrom.com/tutorial.html)) to this **solo-desk timing editor**. Status keys: **Yes** = usable in GUI today; **Bridge** = import/export JSON only; **Partial** = incomplete; **No** = not implemented; **N/A** = different diagram type (not timing).

Last reviewed after Phase 5 backlog (2026-06-03). Tests: **175/175**.

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
| `x` | Unknown | Yes | Yes | Toolbar → set `x` |
| `z` | High-Z | Yes | Yes | Set mode |
| `u` `d` | Weak pull-up/down | Yes | **Yes** (dashed/lighter stroke) | Set mode |
| `p` `n` | Clock (+ / − edge) | Yes | Yes | Set / patterns |
| `P` `N` | Clock with arrow | Yes | **Yes** (arrow glyph canvas + export) | `P`/`N` keys + toggle |
| `=` `2`–`9` | Bus value + color | Yes | Yes (vector lanes) | **Yes** (paint tool + color swatches) |
| `\|` | Gap over previous | Yes | Yes (`drawStepGap`) | Low |

## Bus / vector lanes (`data` + `=`/`2`–`9`)

| Feature | WaveDrom | This editor | Priority |
|---------|----------|-------------|----------|
| Import vector wave + `data[]` labels | Yes | **Yes** | — |
| Export vector + labels | Yes | **Yes** | `busDataRoundTrip.test.ts` |
| Canvas paint / segment editor | Editor | **Yes** | Paint drag on bus rows; `VectorSegmentEditor` in panel |
| Per-segment colors (`2`–`9`) | Yes | **Yes** | Toolbar swatches + segment editor |
| Multi-word `data` (string or array) | Yes | **Bridge** | — |

## Per-signal fields (besides `wave`)

| Field | WaveDrom | This editor | Priority |
|-------|----------|-------------|----------|
| `data[]` — value **labels** on bus slots | Yes | **Yes** | Panel editor + paint label field |
| `period` — cycles per step | Yes | **Yes** | `SignalTimingBar` + per-lane column width on canvas |
| `phase` — horizontal shift | Yes | **Yes** | `SignalTimingBar` + `laneTiming` / render |
| `node` — anchor letters for `edge` | Yes | **Yes** | Tools + optional **ABC** toggle; dim letters while edge tool active |
| `skin` on signal | Ignored | **No** | Low |

## Global `config` and header/footer

| Field | WaveDrom | This editor | Priority |
|-------|----------|-------------|----------|
| `config.hscale` | Yes | **Yes** | Toolbar number input; fractional values (e.g. `1.5`) |
| `config.skin` | Yes | **No** | Low (app themes replace for solo desk) |
| `head.text` + `tick` + `every` | Yes | **Yes** | `HeadFootFields` + canvas render |
| `foot.text` + `tock` + `every` | Yes | **Yes** | Same |
| Root-level `head` / `foot` (not only in `config`) | Yes | **Bridge** | Import merges into `config` |

> [!TIP]
> “Labels” in WaveDrom usually means **bus `data` labels** (text on colored blocks) or **head/foot figure text**, not arbitrary canvas stickers. Use WaveDrom `edge[]` tools for dependency arrows and span labels.

## Dependency arrows (`edge[]`)

| Feature | WaveDrom | This editor | Priority |
|---------|----------|-------------|----------|
| `edge: ["a->b label", …]` | Yes | **Partial** | Arrow + timespan tools; status bar list + delete |
| Arrow shapes `-`, `\|`, `~`, `/`, `#` | Yes | **Yes** | Sequential routing; toolbar shape preset + status edit |
| Import `edge` from JSON | Yes | **Yes** | — |
| Export `edge` to JSON | Yes | **Yes** | — |
| Live placement preview | Editor | **Yes** | `EdgeToolOverlay` — dashed path, span band, anchor badges |

See upstream example: `docs/wavedrom-ref/upstream-tests/signal-arcs.json5`.

## Editor / UX (visual canvas, WaveDrom-safe)

| Feature | WaveDrom editor | This editor | Priority |
|---------|-----------------|-------------|----------|
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

## Explicitly out of scope (solo desk fork A)

| Item | Reason |
|------|--------|
| `backend/`, database, auth | Locked in `agent.md` |
| VCD import/export | Out of scope — see `agent.md` |
| Non-WaveDrom annotation overlay | Removed — use `edge[]` |
| `reg` / `assign` diagram editing | Different product surface |
| Real-time collaboration | Solo desk |

## Suggested next work (priority)

1. **Sub-cycle wave syntax** — spike only if needed; see `docs/wavedrom-ref/SUBCYCLE.md`.
2. **Upstream pixel parity** — extend `upstreamSvgGolden.test.ts` beyond structural smoke.
3. **Edge UX** — optional drag mid-point for `~` curves.
4. **Compare split** — canvas vs WaveDrom preview side-by-side (medium effort).

## Related files in this repo

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
