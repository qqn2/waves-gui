# WaveDrom GUI Editor

Browser-based timing diagram editor: paint waveforms on a canvas, keep WaveDrom JSON in sync, save files locally. **Client-only** — no server or database.

## Solo desk scope

Built for **one engineer at a desk**: open a diagram from the repo, edit, save JSON next to RTL or docs. Version control and sharing are handled by **Git**, not by this app.

| In scope | Out of scope |
|----------|----------------|
| Open / Save / New, export PNG/SVG/JSON | Backend, API, Postgres, auth |
| Paint, erase, toggle (NOT), undo | Team libraries, cloud sync |
| Live JSON editor + samples | VCD |

## Quick start

From the project folder, run `make` to see commands. Typical flow:

```bash
make install   # first time only
make dev       # editor at http://localhost:5173 — stop with Ctrl+C
```

To ship a static copy: `make build` (creates `dist/`). Try it locally with `make preview`.

Before sharing changes: `make check` (runs tests and build).

**Windows:** use [WSL](https://learn.microsoft.com/en-us/windows/wsl/) and run the commands above, or use `npm install` / `npm run dev` / `npm test` / `npm run build` in PowerShell if Node is installed.

```bash
make test      # vitest only
make check     # test + production build
```

## Architecture

```
  File / JSON editor          Canvas + tools
         │                           │
         ▼                           ▼
   wavedromBridge  ◄────►  DiagramState  ◄── Zustand store (src/shared/store/)
   (import/export)              │
                                ▼
                          CanvasRenderer
                          (draw only — no JSON parsing)
```

| Layer | Folder | Role |
|-------|--------|------|
| **Document** | `src/shared/types.ts`, `store/` | `DiagramState` = what gets saved (signals, steps, edges, config) |
| **View** | `store/` → `ViewState` | Zoom, scroll, active tool, paint color — **not** saved to file |
| **Bridge** | `src/wavedromBridge/` | **Only** place that reads/writes WaveDrom JSON (`wave`, `data[]`, `edge[]`, `node`, …) |
| **Renderer** | `src/renderer/` | Draws `DiagramState` on `<canvas>`; hit-test maps mouse → signal + step |
| **Tools** | `src/tools/` | Pointer events → store actions (paint, erase, edges) |
| **UI shell** | `src/shell/`, `signalPanel/`, `codePanel/` | Layout, toolbar, JSON editor, file I/O |

### WaveDrom field mapping

Internal names vs WaveDrom JSON (encode/decode in `wavedromBridge/`):

| Internal (`DiagramState`) | WaveDrom JSON | Meaning |
|---------------------------|---------------|---------|
| `Signal.states[]` | `signal[i].wave` | One character per time step for bit lanes |
| `Signal.segments[]` | `signal[i].data[]` | Bus labels per span (`=` in wave marks spans) |
| `Signal.node` | `signal[i].node` | Anchor letters (A–Z) for dependency arrows |
| `Signal.stepGaps[]` | `\|` in `wave` | Vertical gap before next column |
| `Signal.stepGlitches[]` | repeated char in `wave` (e.g. `00`) | Spurious transition between steps |
| `Signal.period`, `phase` | `signal[i].period`, `.phase` | Lane timing stretch / shift |
| `DiagramState.edges[]` | top-level `edge[]` | Dependency arrows (`a~>b`, optional label) |
| `DiagramConfig.head/foot` | `head`, `foot` | Title, tick/tock labels |

### Undo and code sync

- Diagram edits call `pushHistory()` in the store (snapshot before mutation).
- **Not** undoable: zoom, scroll, tool selection, `paintDraft` (live drag preview).
- Canvas edits must **flush** the JSON editor first (`codeFlush.ts` / `flushRegistry.ts`) so code and canvas never fight.

### Key source files

1. `src/shared/types.ts` — domain model
2. `src/shared/store/` — all mutations (`store/index.ts`)
3. `src/wavedromBridge/waveStringCodec.ts` — `wave` string encode/decode
4. `src/renderer/CanvasRenderer.ts` — draw pipeline
5. `src/tools/useToolHandler.ts` — pointer → tool routing

## Project layout

| Path | Role |
|------|------|
| `src/shared/` | Types, Zustand store, theme |
| `src/renderer/` | Canvas + hit test |
| `src/wavedromBridge/` | WaveDrom JSON import/export |
| `src/tools/` | Paint, erase, edge tools |
| `src/signalPanel/` | Left label column |
| `src/codePanel/` | CodeMirror JSON editor |
| `src/shell/` | Toolbar, layout, file I/O |
| `src/exportEngine/` | PNG / SVG / JSON export |
| `src/patterns/` | Predefined waveform templates |
| `public/samples/` | Example diagrams |

## Further reading

| Document | Purpose |
|----------|---------|
| [`agent.md`](./agent.md) | Product scope, coding rules, build history |
| [`docs/FUTURE_FEATURES.md`](docs/FUTURE_FEATURES.md) | WaveDrom capability matrix and gaps |
| [`docs/wavedrom-ref/`](docs/wavedrom-ref/) | Vendored WaveJSON notes and upstream fixtures |
