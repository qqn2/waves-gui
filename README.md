# waves-gui

A browser-based timing-diagram editor: paint waveforms on a canvas, keep WaveDrom-compatible JSON synchronized, and export JSON, SVG, PNG, or JPEG. The application is client-only—there is no server, database, account, or cloud synchronization.

> This is an independent community project and is not affiliated with or endorsed by WaveDrom or its maintainers.

## Scope

waves-gui is built for one engineer at a desk. Open or create a diagram, edit it locally, save it beside RTL or documentation, and let Git handle versioning and sharing. A backend, authentication, collaborative libraries, VCD support, and real-time collaboration are intentionally out of scope.

## Quick start

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`. A production build is created with `npm run build` and can be inspected with `npm run preview`.

## Privacy

- Diagram editing and rendering happen in the browser. The app has no analytics and does not send diagrams to a remote service unless you explicitly confirm **Open in WaveDrom Editor**.
- **Open in WaveDrom Editor** puts the complete diagram JSON in a `wavedrom.com` query URL after showing a privacy warning. That URL may be retained in browser history, network infrastructure, or WaveDrom server logs. Do not use it for confidential diagrams.
- For crash recovery, the complete current diagram is automatically stored in this browser's `localStorage`. Recent file **names** are stored there too.
- This browser-local data does not synchronize to another browser or device. It disappears when site data is cleared.
- Do not use shared browser profiles for confidential work. Clear this site's data after use on a shared machine.

## Architecture

```text
File / JSON editor <-> wavedromBridge <-> DiagramState <-> Zustand store
                                                |
                                                v
                                         CanvasRenderer
```

- `src/shared/` contains the document model and store.
- `src/wavedromBridge/` is the only layer that parses or emits WaveDrom JSON.
- `src/renderer/` and `src/tools/` implement canvas drawing, hit testing, and editing.
- `src/codePanel/` contains the lazy-loaded CodeMirror editor and local WaveDrom preview.
- `src/shell/` provides file operations, layout, autosave, and recent filenames.
- `src/exportEngine/` creates downloadable JSON and inert, escaped image output.

## Development and tests

```bash
npm run lint          # static checks
npm test              # unit, integration, and security tests
npm run test:security # hostile-label tests only
npm run build         # TypeScript + Vite + runtime license bundle
npm run check         # complete non-browser release gate
npm run test:e2e      # Chromium and Firefox deployment flows
```

Install browser binaries once with `npx playwright install chromium firefox`. See [CONTRIBUTING.md](CONTRIBUTING.md) for engineering rules and disclosure hygiene.

## Deployment

The repository defines an assets-only Cloudflare Worker in `wrangler.jsonc`; it has no Worker script or backend. `public/_headers` is copied into the build and supplies the production security policy.

Manual deployment:

```bash
npm ci
npm run deploy
```

For Cloudflare dashboard/Git deployment, import this GitHub repository as a Worker, use `npm run build` as the build command, and `dist` as the asset directory. Keep the checked-in Wrangler configuration as the deployment source of truth. Verify `/`, `/licenses/THIRD_PARTY_NOTICES.txt`, a nonexistent SPA route, and the response headers after every deployment.

Clipboard image export requires HTTPS (or localhost). Blob-based downloads and the local SVG preview are permitted by the checked-in CSP; background network connections, framing, camera, microphone, location, and other unnecessary capabilities are denied. The explicitly confirmed WaveDrom handoff is a top-level navigation to the external editor.

## Security reporting

Please report vulnerabilities privately through [GitHub Security Advisories](https://github.com/qqn2/waves-gui/security/advisories/new). Do not open a public issue with a vulnerability, confidential diagram, proprietary signal name, credential, or internal screenshot. See [SECURITY.md](SECURITY.md).

For ordinary defects, use the in-app **Report a bug** action or the [safe bug-report form](https://github.com/qqn2/waves-gui/issues/new?template=bug_report.yml). Reduce the problem to synthetic signal names and include the browser, window size, and display scaling for visual issues.

## Licensing and attribution

Original project code is available under the [MIT License](LICENSE). Runtime dependency copyright and license texts are generated deterministically in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and are shipped under `/licenses/` in every production build. Vendored WaveDrom and `wavedrom/schema` reference fixtures are attributed in `docs/wavedrom-ref/SOURCES.md`.

WaveDrom compatibility is a file-format and rendering integration; it does not imply affiliation, endorsement, or ownership of the WaveDrom project or name.
