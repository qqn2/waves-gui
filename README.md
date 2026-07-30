# waves-gui

A browser-based visual editor for **WaveDrom and Undulate timing diagrams**.
Draw digital and analogue waveforms, edit structured annotations, keep the
source synchronized, and export publication-ready diagrams without a backend.

waves-gui supports the documented declarative waveform features of WaveDrom
and the pinned Undulate revision. See
[Format compatibility](docs/FORMAT_COMPATIBILITY.md) for the precise contract,
safety boundaries, and intentional exclusions.

> This is an independent community project. It is not affiliated with or
> endorsed by WaveDrom, Undulate, or their maintainers.

## Highlights

- Paint digital, clock, bus, metastability, impulse, and held-edge states.
- Create and paint analogue step, capacitive, sampled-curve, hold,
  metastability, and impulse cells.
- Edit integer sub-step timing, repeat, per-cell periods, duty cycles, phase,
  and digital or analogue slew.
- Create text, line, compression, and structured-arrow annotations directly on
  the canvas.
- Edit signal values, timing, styles, overlays, sampled points, and annotation
  anchors through inspectors.
- Keep visual edits and JSON, JSONML, YAML, or TOML source synchronized, with
  undo, redo, autosave, and browser-local crash recovery.
- Import VCD traces through the dedicated **Open VCD** action.
- Render locally and export SVG, PNG, JPEG, PDF, EPS, terminal text, WaveDrom
  JSON, or Undulate JSON/YAML/TOML.
- Check compatibility before converting an Undulate document to WaveDrom.

## Formats

| Format | Open and edit | Save/export |
| --- | --- | --- |
| WaveDrom JSON/JSON5/JSONML | Yes | Yes |
| Undulate JSON/JSONML | Yes | Yes |
| Undulate YAML 1.2 | Yes | Yes |
| Undulate TOML | Yes | Yes |
| VCD | Import | Convert to an editable diagram |
| SVG, PNG, JPEG | — | Yes |
| PDF, EPS, terminal text | — | Yes |

The Undulate toggle enables extension authoring. Turning it off offers explicit
choices when the document contains features that WaveDrom cannot represent:
cancel, hide and preserve them, or remove them. WaveDrom export reports
incompatibilities instead of silently dropping content.

## Quick start

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`. Create a production build with `npm run build`
and inspect it with `npm run preview`.

## Product scope

waves-gui is designed for one engineer working locally. Open or create a
diagram, edit it in the browser, save it beside RTL or documentation, and use
Git for versioning and sharing.

The application intentionally has no backend, accounts, cloud synchronization,
shared diagram library, or real-time collaboration. Undulate register diagrams,
arbitrary code execution, unsafe remote/CSS resources, and pixel-identical
reproduction of Undulate's Python/Cairo backend are also outside the product
contract.

## Privacy

- Diagram editing and rendering happen in the browser. The app has no analytics
  and does not send diagrams to a remote service unless you explicitly confirm
  **Open in WaveDrom Editor**.
- **Open in WaveDrom Editor** puts the complete compatible diagram JSON in a
  `wavedrom.com` query URL after showing a privacy warning. That URL may be
  retained in browser history, network infrastructure, or WaveDrom server
  logs. Do not use it for confidential diagrams.
- The complete current diagram is stored in this browser's `localStorage` for
  crash recovery. Recent file names are stored there too.
- Browser-local data does not synchronize to another browser or device and
  disappears when site data is cleared.
- Do not use shared browser profiles for confidential work. Clear this site's
  data after use on a shared machine.

## Architecture

```text
JSON / JSONML / YAML / TOML / VCD
                 |
                 v
   wavedromBridge + undulateBridge
                 |
                 v
        DiagramState + Zustand
          /              \
         v                v
  Canvas renderer     Code editor
         |
         v
 Image and text exporters
```

- `src/shared/` contains the document model, compatibility rules, and store.
- `src/wavedromBridge/` parses and emits the WaveDrom-compatible model.
- `src/undulateBridge/` validates, parses, preserves, and emits Undulate
  extensions and mapping formats.
- `src/importers/` contains non-document importers such as VCD.
- `src/renderer/` and `src/tools/` implement canvas rendering, hit testing, and
  visual editing.
- `src/codePanel/` contains the lazy-loaded CodeMirror editor and local preview.
- `src/shell/` provides file operations, layout, inspectors, autosave, and
  recent filenames.
- `src/exportEngine/` creates downloadable source, image, document, and
  terminal output.

## Development and tests

```bash
npm run lint          # static checks
npm test              # unit, integration, and security tests
npm run test:visual   # pinned Undulate visual-conformance fixtures
npm run test:security # hostile-input tests
npm run build         # TypeScript + Vite + runtime license bundle
npm run check         # complete non-browser release gate
npm run test:e2e      # Chromium and Firefox deployment flows
```

Install browser binaries once with
`npx playwright install chromium firefox`. See
[CONTRIBUTING.md](CONTRIBUTING.md) for engineering rules and disclosure
hygiene.

## Deployment

The repository defines an assets-only Cloudflare Worker in `wrangler.jsonc`;
it has no Worker script or backend. `public/_headers` is copied into the build
and supplies the production security policy.

Manual deployment:

```bash
npm ci
npm run deploy
```

For Cloudflare dashboard/Git deployment, import this GitHub repository as a
Worker, use `npm run build` as the build command, and `dist` as the asset
directory. Keep the checked-in Wrangler configuration as the deployment source
of truth. Verify `/`, `/licenses/THIRD_PARTY_NOTICES.txt`, a nonexistent SPA
route, and the response headers after every deployment.

Clipboard image export requires HTTPS or localhost. Blob-based downloads and
the local preview are permitted by the checked-in content security policy;
background network connections, framing, camera, microphone, location, and
other unnecessary capabilities are denied. The explicitly confirmed WaveDrom
handoff is a top-level navigation to the external editor.

## Security reporting

Please report vulnerabilities privately through
[GitHub Security Advisories](https://github.com/qqn2/waves-gui/security/advisories/new).
Do not open a public issue containing a vulnerability, confidential diagram,
proprietary signal name, credential, or internal screenshot. See
[SECURITY.md](SECURITY.md).

For ordinary defects, use the in-app **Report a bug** action or the
[safe bug-report form](https://github.com/qqn2/waves-gui/issues/new?template=bug_report.yml).
Reduce the problem to synthetic signal names and include the browser, window
size, and display scaling for visual issues.

## Licensing and attribution

Original project code is available under the [MIT License](LICENSE). Runtime
dependency copyright and license texts are generated deterministically in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and shipped under `/licenses/`
in every production build. Vendored WaveDrom and `wavedrom/schema` reference
fixtures are attributed in [docs/wavedrom-ref/SOURCES.md](docs/wavedrom-ref/SOURCES.md).

WaveDrom and Undulate compatibility describe file-format and rendering
integration. They do not imply affiliation, endorsement, or ownership of
either project or name.
