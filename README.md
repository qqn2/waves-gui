# WaveDrom GUI Editor

Browser-based timing diagram editor with a visual canvas workflow: draw waveforms on a canvas, keep WaveDrom JSON in sync, save files locally. **Client-only** — no server or database.

## Solo desk scope

Built for **one engineer at a desk**: open a diagram from the repo, edit, save JSON next to RTL or docs. Version control and sharing are handled by **Git**, not by this app.

| In scope | Out of scope |
|----------|----------------|
| Open / Save / New, export PNG/SVG/JSON | Backend, API, Postgres, auth |
| Paint, erase, toggle (NOT), undo | Team libraries, cloud sync |
| Live JSON editor + samples | VCD, non-WaveDrom annotations in UI |

See [`agent.md`](./agent.md) (Solo desk scope) and [`ORCHESTRATOR_PROMPT.md`](./ORCHESTRATOR_PROMPT.md) for build process and tracks.

## Quick start

From the project folder, run `make` to see commands. Typical flow:

```bash
make install   # first time only
make dev       # editor at http://localhost:5173 — stop with Ctrl+C
```

To ship a static copy: `make build` (creates `dist/`). Try it locally with `make preview`.

Before sharing changes: `make check` (runs tests and build).

**Windows:** use [WSL](https://learn.microsoft.com/en-us/windows/wsl/) and run the commands above, or use `npm install` / `npm run dev` / `npm test` / `npm run build` in PowerShell if Node is installed.

## Verify

```bash
make test
make check
```

## Project layout

| Path | Role |
|------|------|
| `src/shared/` | Types, Zustand store, theme |
| `src/renderer/` | Canvas + hit test |
| `src/wavedromBridge/` | WaveDrom JSON import/export |
| `src/codePanel/` | CodeMirror JSON editor |
| `src/shell/` | Toolbar, layout, file I/O |
| `public/samples/` | Example diagrams |

Spec and parallel build plan: `agent.md`, `PROGRESS.md`.

WaveDrom capability checklist (labels, `edge`, head/foot, etc.): [`docs/FUTURE_FEATURES.md`](docs/FUTURE_FEATURES.md). Vendored upstream docs: [`docs/wavedrom-ref/`](docs/wavedrom-ref/).
