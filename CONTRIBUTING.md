# Contributing

waves-gui is intentionally a client-only, solo-desk timing-diagram editor. Keep changes within that scope unless a concrete user story requires otherwise. A backend, authentication, cloud synchronization, VCD support, and real-time collaboration are out of scope.

## Development

Install with `npm ci`, run the app with `npm run dev`, and validate changes with `npm run check`. Browser tests use `npm run test:e2e` after `npx playwright install chromium firefox`.

Key implementation rules:

- Keep WaveDrom parsing and emission in `src/wavedromBridge/`.
- Flush pending JSON edits before canvas actions so debounced code cannot overwrite a paint stroke.
- Use the Zustand store actions for document mutations and preserve undo history.
- Recurse through nested signal groups; never assume the signal list is flat.
- Reuse geometry constants from `src/shared/constants.ts` and keep hit testing in CSS pixels.
- Keep global CSS in `src/index.css` or `src/shared/theme.css`; component styles belong in CSS modules.
- Test behavior changes and run `npm run check` before opening a pull request.

Do not put confidential diagrams, proprietary signal names, credentials, or internal machine paths in issues, fixtures, screenshots, or commits.
