# Sample Browser and Protocol Curriculum Implementation Plan

## Decision summary

Replace the current nested sample flyout with a dedicated, metadata-driven Sample Browser. The browser will be a large modal on desktop and a full-screen surface on narrow layouts. It will load a compact catalog first and load at most one waveform document for the selected preview.

The first curriculum will contain 40 focused samples. It deliberately favors:

- fundamentals that recur across protocols;
- AMBA, NoC, CDC, reset, clocking, memory, low-power, DFT, and peripheral-integration scenarios with broad system-design value;
- PCIe, IOMMU, DMA, credit, ordering, and translation scenarios that broaden the advanced-protocol coverage;
- correct/incorrect pairs that make protocol rules inspectable rather than merely decorative.

This document is an implementation plan, not authorization to add all 40 waveform assets in one pull request. The browser foundation and a small representative vertical slice should land before bulk content authoring.

## Why this change is needed

The existing sample feature is already useful but cannot scale:

- `src/shell/samples.ts` hard-codes a tree containing 15 sample leaves.
- `src/shell/toolbar/SampleLibraryMenu.tsx` renders nested hover flyouts from the File menu.
- `public/samples/` contains 15 waveform JSON documents plus one VCD example.
- `loadSampleDiagram()` immediately replaces the editor document after a discard confirmation.
- Metadata is limited to ID, title, description, and file, so the app cannot support meaningful search, difficulty, protocol concepts, validity state, objectives, or related lessons.
- Hover-based nesting is difficult to scan, poor on narrow/touch layouts, and will become unusable with hundreds of entries.

The app should expose a small relevant slice of the catalog at any time. The complete library belongs in data, not in a permanently expanded UI.

## Product goals

1. Turn samples into a protocol-learning curriculum, with one main rule or failure mode per sample.
2. Keep the editor visually quiet: one `Browse samples...` entry replaces the nested catalog.
3. Make search the primary way to reach a known concept, signal, or protocol.
4. Support browsing by category, protocol, concept, difficulty, and sample status.
5. Make intentionally invalid traces unmistakable and explain the violated rule.
6. Preview a sample without replacing or dirtying the current document.
7. Distinguish read-oriented lessons from editable starter templates.
8. Keep sample addition a data/content operation rather than a React-component change.
9. Preserve a client-only, offline-capable, dependency-light application.
10. Build a reusable technical artifact that is credible as both product work and protocol study.

## Non-goals for the first release

- Do not expose the exhaustive 800-plus idea list.
- Do not add accounts, cloud sync, telemetry, quizzes, or cross-device progress.
- Do not render a live canvas for every result row.
- Do not add a third-party search service or search dependency.
- Do not add list virtualization until measured result sizes justify it.
- Do not claim standards conformance merely because a diagram renders.
- Do not implement deep hierarchies beyond `Category -> Protocol -> Scenario`.
- Do not make favorites, recents, or learning progress prerequisites for the browser launch.

## Information architecture

Use ten top-level categories for the initial catalog:

1. Fundamentals
2. Clocking and Reset
3. CDC
4. AMBA
5. Interconnect and DMA
6. Memory and Registers
7. Serial and Peripheral Interfaces
8. Power, Safety, and DFT
9. PCIe and Address Translation
10. Verification and GUI Stress

The UI has two primary views:

- **Browse by protocol:** category selection narrows the protocol/scenario list.
- **Search by concept:** a global query crosses protocol boundaries, so `backpressure`, `credits`, `reset`, `valid ready`, or a signal such as `PREADY` can reveal related lessons.

Use stable sample IDs with this convention:

```text
<protocol-or-domain>/<scenario>
```

Examples:

```text
ready-valid/payload-stable-under-backpressure
cdc/raw-pulse-lost-invalid
axi4/write-burst-incrementing
pcie/tag-reused-before-completion-invalid
```

Do not encode UI category names, difficulty, or correctness in the path; those are metadata and may evolve.

## Browser interaction model

### Entry points

Phase 1 adds only:

- a `Browse samples...` row in the File menu;
- a compact `Samples` toolbar button if space permits without wrapping;
- a `Browse all samples ->` action in the empty-state/welcome surface if that surface is introduced independently.

Remove the recursive hover flyout. The File menu must remain a short list of document operations.

### Desktop layout

Use a large modal, approximately `min(1120px, calc(100vw - 48px))` by `min(760px, calc(100vh - 48px))`:

```text
+-----------------------------------------------------------------------+
| Sample library                    [ Search concepts or signals... ] [x]|
+----------------+-------------------------------+----------------------+
| Featured       | Results                       | Preview              |
| Fundamentals   | AXI4-Lite: AW before W        | waveform             |
| Clock & reset  | AXI4-Lite: W before AW        | status / difficulty  |
| CDC            | AXI4: write backpressure      | summary              |
| AMBA           | ...                           | learning objectives  |
| ...            |                               | rule / violation     |
|                |                               | related samples      |
+----------------+-------------------------------+----------------------+
| 18 results                                     | [Read] [Edit a copy] |
+-----------------------------------------------------------------------+
```

- Left rail: stable category choices plus `Featured` and, later, `Favorites` and `Recent`.
- Center: compact result rows, not screenshot cards.
- Right: details and one lazily loaded preview.
- Category selection and search are complementary. A clear-filter action must be visible whenever a filter is active.

### Narrow layout

Below the existing narrow-layout threshold, use a full-screen dialog:

1. Search and category controls remain at the top.
2. Results occupy the main view.
3. Selecting a result opens a detail subview with a Back action.
4. Do not attempt to preserve the three-column desktop layout.

### Progressive disclosure

For a protocol page, show `Essential` samples first. Intermediate, advanced, and intentionally invalid groups start collapsed. Search results are ungrouped and ranked.

Initial display limits:

- 4-8 featured samples;
- 5-10 essentials for a selected protocol;
- 40 results per search batch;
- `Show more` for additional results.

At the initial catalog size, this is simpler and more reliable than virtualization. Revisit virtualization only after profiling a catalog above roughly 200 entries or a filtered result set above 100.

## Catalog and content model

### Filesystem layout

Use metadata and waveform files under the static asset tree so the app remains client-only:

```text
public/
  samples/
    catalog.v1.json
    fundamentals/
      ready-valid-basic.json
      ready-valid-backpressure.json
    cdc/
      two-flop-synchronizer.json
      raw-pulse-lost-invalid.json
    ...
src/
  sampleLibrary/
    catalogTypes.ts
    catalogLoader.ts
    catalogValidation.ts
    searchIndex.ts
    sampleLoader.ts
    sampleSession.ts
    SampleBrowser.tsx
    SampleBrowser.module.css
    SampleResultList.tsx
    SampleDetails.tsx
    SamplePreview.tsx
```

Keep the current asset URLs working during migration. Move existing files into category folders only in a dedicated mechanical change, or add a temporary `legacyFile`/unchanged `file` path. Do not mix a large path move with browser behavior unless the test suite proves every catalog path.

### Manifest schema

Use a versioned JSON manifest. Define matching TypeScript types and validate unknown JSON at runtime; do not cast fetched JSON directly.

```ts
type SampleKind = 'lesson' | 'template' | 'stress';
type SampleStatus = 'correct' | 'incorrect' | 'corner-case' | 'conceptual';
type SampleDifficulty = 'beginner' | 'intermediate' | 'advanced';
type CurriculumTier = 'essential' | 'intermediate' | 'advanced';

interface SampleManifestEntry {
  id: string;
  title: string;
  category: string;
  protocol: string;
  kind: SampleKind;
  status: SampleStatus;
  difficulty: SampleDifficulty;
  tier: CurriculumTier;
  summary: string;
  file: string;
  concepts: string[];
  keywords: string[];
  signals: string[];
  learningObjectives: string[];
  featureTags: string[];
  related: string[];
  pairWith?: string;
  featured?: boolean;
  rule?: string;
  violation?: {
    at: string;
    explanation: string;
    expected: string;
    assertion?: string;
  };
  reference?: {
    label: string;
    edition?: string;
    section?: string;
    url?: string;
  };
}

interface SampleCatalogV1 {
  schemaVersion: 1;
  categories: Array<{ id: string; label: string; order: number }>;
  samples: SampleManifestEntry[];
}
```

Rules:

- IDs and file paths are unique.
- `related` and `pairWith` targets exist.
- `incorrect` entries require `violation` metadata.
- `lesson` entries require at least one learning objective.
- `signals`, `concepts`, and `keywords` use normalized values without UI punctuation.
- `featureTags` describe Waves GUI coverage such as `groups`, `gaps`, `glitches`, `fine-timing`, `annotations`, `dependency-edges`, `bus-labels`, or `metastability`.
- A standards reference identifies the source used to author the lesson. It is evidence metadata, not a conformance certification.
- Avoid reproducing copyrighted specification figures. Author original timing traces from stated rules.

### Catalog loading

1. Do not fetch the catalog during application bootstrap.
2. Fetch and validate `catalog.v1.json` when the browser is opened for the first time.
3. Cache the validated catalog in module state for the rest of the session.
4. Build the search index once from the validated entries.
5. Fetch a waveform only when its result becomes the selected preview or is opened.
6. Cache a small number of parsed previews by sample ID. A simple bounded map of 8-12 entries is sufficient.
7. Cancel or ignore stale preview fetches when selection changes rapidly.
8. Display recoverable inline error states for catalog, preview, and open failures; do not use `window.alert` inside the browser.

## Search and filters

Implement dependency-free, deterministic in-memory search for Phase 1.

Normalize to lowercase Unicode text, split on whitespace/punctuation, and search these fields with weighted ranking:

| Field | Weight |
|---|---:|
| exact ID/title/protocol match | 10 |
| title prefix/token match | 8 |
| protocol and signal names | 6 |
| concepts and keywords | 5 |
| summary | 2 |

All query tokens must match somewhere, but they do not need to match the same field. Preserve manifest order as the final stable tie-breaker.

Examples that must work:

- `valid ready` finds generic ready/valid, AXI, and AXI-Stream lessons.
- `pready wait` finds APB wait-state lessons.
- `cdc pulse` finds lost-pulse and toggle/pulse-synchronizer lessons.
- `credits` finds NoC and PCIe flow-control lessons.
- `w1c` finds firmware/register race lessons through an alias keyword.

Phase 1 filters:

- category;
- protocol;
- difficulty;
- status (`Correct`, `Incorrect`, `Corner case`, `Conceptual`);
- kind (`Lesson`, `Template`, `Stress`).

Concept chips in the details pane are clickable shortcuts that replace/add the corresponding concept filter.

## Preview and document-opening behavior

### Preview isolation

Preview must never use `loadSampleDiagram()` and must never touch the Zustand editor store.

`SamplePreview.tsx` should parse the selected asset into component-local state and draw it on a dedicated canvas using the existing renderer. Use a fixed preview view (fit-to-width, no editor selection, no tool overlays). If direct reuse of `CanvasRenderer` proves too coupled, generate one static SVG thumbnail per sample at build time; do not instantiate a hidden editor store.

### Read lesson

`Read lesson` opens the sample in a protected sample session:

- save `sampleId` and `mode: 'readonly'` in ephemeral view/session state;
- show a visible `Read-only sample` banner with `Edit a copy` and `Return` actions;
- disable mutations in the UI and guard them at the store action boundary so keyboard shortcuts cannot modify the lesson;
- retain the existing dirty-document confirmation before replacing the user's current document;
- clear the file handle; a bundled sample must never overwrite an unrelated local file.

The mutation guard is the riskiest part of this feature. Inventory every document-changing store action and test representative mouse, keyboard, inspector, source-editor, undo/redo, and code-apply paths. If a reliable store-level guard cannot be completed in the first pull request, ship preview plus `Edit a copy` and defer main-editor read-only mode rather than presenting a false lock.

### Edit a copy

`Edit a copy`:

- confirms before replacing a dirty document;
- parses and deep-clones the bundled diagram;
- clears any file handle and read-only sample session;
- assigns a suggested filename based on the sample slug without treating it as an existing file;
- leaves Save using the normal browser save/picker flow;
- preserves a non-persisted `derivedFromSampleId` for later recent/favorite tracking if useful.

Templates skip the read-only framing and default to `Edit a copy`. Stress samples default to preview/read-only.

## Correct and intentionally incorrect samples

Status is a first-class visual and semantic property:

- `Correct`: neutral/positive label, no warning icon.
- `Incorrect`: warning icon, warning color, and the word `Incorrect` in text.
- `Corner case`: distinct label without implying invalidity.
- `Conceptual`: clearly states that the trace illustrates an idea rather than exact electrical behavior.

For an incorrect sample, the detail pane must show:

1. rule violated;
2. location in the trace;
3. why it fails;
4. expected correct behavior;
5. an assertion or assertion-shaped check when appropriate;
6. a link to the paired correct sample.

Color alone must never communicate validity.

## Initial curriculum

### Selection rationale

Prioritize the following established foundations:

- RTL and subsystem integration;
- AMBA/APB/AXI and NoC-facing work;
- CDC, reset distribution, clock gating, and interface timing debug;
- memory macros, NVM controllers, ECC/fault-injection context, DFT/test mode, and ASIL-D work;
- SPI, eMMC, UART, watchdog, register-map, low-power/UPF, synthesis, and STA workflows.

Expand into these complementary advanced topics:

- PCIe transaction/completion behavior, tags, credits, ordering, and replay concepts;
- IOMMU translation, IO-TLBs, page walks, faults, and DMA integration;
- chiplet/credit-based interconnect concepts after the PCIe/IOMMU foundation.

Therefore the initial set should not spend equal effort on every popular protocol. CAN, USB packet details, Ethernet, JTAG, DDR training, cache coherency, and broad serial-protocol coverage remain valuable Phase 2 material, but they follow the core scenarios below.

### First 40 samples

| # | ID | Status | Main lesson | Product rationale |
|---:|---|---|---|---|
| 1 | `ready-valid/basic-transfer` | Correct | Transfer occurs only on `valid && ready` | Foundation for AXI and streaming |
| 2 | `ready-valid/backpressure` | Correct | Producer holds payload stable while stalled | Core reusable flow-control rule |
| 3 | `ready-valid/payload-mutates-invalid` | Incorrect | Payload changes before acceptance | Strong assertion-teaching pair |
| 4 | `handshake/four-phase-request-ack` | Correct | Return-to-zero request/acknowledge | Foundation for control and CDC |
| 5 | `apb/write-no-wait` | Correct | Setup/access phases | Foundation for peripheral/register access |
| 6 | `apb/write-wait-state` | Correct | Control remains stable while `PREADY=0` | Models a common integration/debug case |
| 7 | `ahb/address-data-overlap-with-wait` | Corner case | Pipelined phases and stall propagation | AMBA breadth beyond APB |
| 8 | `axi4-lite/write-aw-before-w` | Correct | AW and W are independent | Common slave-design issue |
| 9 | `axi4-lite/write-w-before-aw` | Correct | W can arrive before AW | Completes the independence lesson |
| 10 | `axi4-lite/read-backpressure` | Correct | `RDATA/RRESP` stability under stall | Relevant to register and bridge behavior |
| 11 | `axi4/write-burst-incrementing` | Correct | Burst address/data and `WLAST` | Moves from AXI-Lite to full AXI |
| 12 | `axi4/out-of-order-reads-by-id` | Correct | ID-based completion ordering | Interconnect/system thinking |
| 13 | `axi4/4k-boundary-crossing-invalid` | Incorrect | Burst violates boundary rule | Protocol-check/assertion example |
| 14 | `arbiter/round-robin-two-requesters` | Correct | Fair grant rotation | NoC and shared-resource foundation |
| 15 | `noc/credit-exhaustion-and-return` | Correct | Credits limit outstanding flits | Introduces a PCIe-related flow-control concept |
| 16 | `cdc/two-flop-level-synchronizer` | Correct | Stable single-bit level crossing | Essential CDC foundation |
| 17 | `cdc/raw-pulse-lost-invalid` | Incorrect | Short pulse disappears in slow domain | High-value failure example |
| 18 | `cdc/toggle-pulse-synchronizer` | Correct | Toggle preserves an isolated event | Paired CDC correction |
| 19 | `cdc/multibit-independent-sync-invalid` | Incorrect | Reconverged bus becomes incoherent | Common static CDC/debug failure mode |
| 20 | `cdc/async-fifo-pointer-crossing` | Correct | Gray pointers synchronize occupancy | Advanced CDC and buffering |
| 21 | `reset/async-assert-sync-deassert` | Correct | Safe reset release | Core reset-distribution pattern |
| 22 | `reset/domain-release-mismatch` | Incorrect | Domains leave reset inconsistently | Integration and RDC failure mode |
| 23 | `clocking/divided-clock-crossing` | Corner case | Related clocks and phase assumptions | Timing/CDC constraint relevance |
| 24 | `clocking/glitch-free-clock-mux` | Correct | Old clock disables before new clock enables | Clock-integration pattern |
| 25 | `clocking/icg-functional-and-test-enable` | Correct | Functional gate plus scan/test override | Links clock gating and DFT behavior |
| 26 | `memory/sram-read-write-collision` | Corner case | Read-first/write-first/no-change policies | Covers memory integration semantics |
| 27 | `memory/ecc-corrected-vs-uncorrectable` | Corner case | Single-bit correct, double-bit flag | Covers memory-controller and safety behavior |
| 28 | `registers/write-one-to-clear-race` | Incorrect | HW event races firmware clear | Models an MMIO/control race |
| 29 | `nvm/nvm-to-mmio-transfer` | Correct | Sequenced NVM load into register space | Reusable IP integration pattern |
| 30 | `safety/watchdog-timeout-and-recovery` | Correct | Timeout, fault indication, safe recovery | Safety-recovery pattern |
| 31 | `power/isolation-reset-power-sequence` | Correct | Isolation/reset ordering around power-off/on | UPF/low-power sequencing |
| 32 | `power/retention-save-restore` | Conceptual | Retention control and restore timing | Builds defensible low-power concepts |
| 33 | `spi/two-masters-drive-miso-invalid` | Incorrect | Bus contention during ownership error | Interface-debug failure mode |
| 34 | `emmc/hs400-input-sampling-window` | Conceptual | Strobe/data sampling and constraint window | Timing-debug case that exercises fine timing |
| 35 | `uart/8n1-transmit-receive` | Correct | Start, data, parity-free stop framing | Serial-interface foundation |
| 36 | `pcie/memory-read-and-completion` | Correct | Non-posted request and tagged completion | Advanced-protocol foundation |
| 37 | `pcie/tag-reused-before-completion-invalid` | Incorrect | Outstanding tag reused too early | Ordering/outstanding-transaction depth |
| 38 | `pcie/credit-exhaustion-and-update` | Correct | Header/data credits throttle traffic | Connects NoC and PCIe flow control |
| 39 | `iommu/iotlb-miss-page-walk-fault` | Correct | Translation hit/miss, walk, and fault path | Covers address-translation fault handling |
| 40 | `dma/descriptor-through-iommu` | Correct | Descriptor fetch and translated data movement | System-level PCIe/IOMMU integration |

Keep the existing Undulate-focused examples in the catalog as `stress` or `template` entries even when they are not numbered as curriculum lessons. They validate analogue rendering, fine timing, annotations, extended states, and style. Add one featured `Verification and GUI Stress` collection entry that points to these existing assets rather than displacing a protocol lesson.

### Correct/incorrect pairs in the first set

At minimum, encode these `pairWith` relationships:

```text
ready-valid/backpressure
<-> ready-valid/payload-mutates-invalid

cdc/toggle-pulse-synchronizer
<-> cdc/raw-pulse-lost-invalid

reset/async-assert-sync-deassert
<-> reset/domain-release-mismatch

pcie/memory-read-and-completion
<-> pcie/tag-reused-before-completion-invalid
```

APB control mutation during wait, unsafe clock gating, AXI VALID withdrawal, IOMMU permission bypass, and power-isolation omission should be the next invalid examples after the first 40.

### Initial learning paths (metadata first, progress later)

Do not build completion tracking in Phase 1, but choose sample metadata so these paths can be added without reauthoring:

- **Protocol foundations:** 1, 2, 3, 4, 14, 15.
- **CDC/reset essentials:** 16-24.
- **SoC subsystem integration:** 5-15, 25-35.
- **PCIe/IOMMU bridge:** 2, 11, 12, 15, 36-40.
- **Safety and low power:** 21, 22, 25, 27, 30-32.

Advanced-protocol paths must be described as study material and must not imply implementation or standards conformance.

## Implementation phases

### Phase 0: Content contract and vertical slice

Deliverables:

- finalize `SampleCatalogV1` and validation rules;
- convert existing 15 entries to the manifest without moving their files;
- add metadata for three representative lessons:
  - ready/valid backpressure (correct),
  - payload mutation under backpressure (incorrect),
  - eMMC input sampling window (fine-timing/conceptual);
- add catalog validation tests and a script/test that parses every referenced waveform;
- document the sample-authoring checklist.

Exit criterion: one correct sample, one incorrect sample, and one native fine-timing sample pass the full metadata -> search -> preview -> open flow.

### Phase 1: Browser foundation

Deliverables:

- replace `SampleLibraryMenu` with `Browse samples...`;
- implement modal/full-screen responsive shell;
- load and validate catalog on first open;
- implement categories, search, filters, compact result rows, details, and lazy preview;
- implement `Edit a copy`;
- implement read-only lesson mode only if store-level mutation protection is complete;
- retain dirty-document confirmation and file-handle safety;
- add loading, empty, and recoverable error states;
- keep existing sample IDs/assets usable.

Exit criterion: the current sample catalog is fully usable from keyboard, mouse, and a narrow viewport without nested hover menus.

### Phase 2: Curriculum content and local library state

Deliverables:

- author the remaining first-40 assets in small reviewed batches by domain;
- add correct/incorrect pair navigation and related samples;
- add favorites and sample recents using versioned local storage;
- add generated thumbnails only if the live single-preview canvas is slow;
- add `Samples | Templates` browsing;
- add assertion text and exact violation markers to invalid lessons.

Recommended content batches:

1. fundamentals and AMBA;
2. CDC, reset, and clocking;
3. memory, register, safety, low-power, DFT, and peripherals;
4. NoC, PCIe, IOMMU, and DMA.

Do not merge a domain batch until a reviewer checks both waveform syntax and the protocol explanation.

### Phase 3: Guided learning

Deliverables:

- learning-path pages;
- local completion/continue state;
- `What is wrong?` reveal mode for invalid samples;
- optional quizzes and rule checks;
- command-palette integration;
- build-time thumbnail generation;
- virtualization if profiling demonstrates a need.

## Code-change map

| Current area | Planned change |
|---|---|
| `src/shell/samples.ts` | Split loading/session logic from catalog data; keep a compatibility re-export temporarily |
| `src/shell/toolbar/SampleLibraryMenu.tsx` | Remove after replacing it with a single browser opener |
| `src/shell/toolbar/ToolbarFileMenu.tsx` | Add `Browse samples...`; stop rendering catalog flyouts |
| `src/shell/Toolbar.tsx` | Own/open browser state or delegate it to the app shell consistently with Export dialog state |
| `src/App.tsx` | Mount one `SampleBrowser` near other top-level dialogs |
| `src/shell/shell.module.css` | Delete flyout-specific sample rules after migration |
| `src/shared/types.ts` | Add minimal ephemeral sample-session state only if read-only/editor session mode lands |
| `src/shared/store/*Actions.ts` | Add centralized writable-session guard if true read-only mode lands |
| `public/samples/` | Add versioned manifest and, incrementally, domain folders/assets |
| `src/shell/samples.test.ts` | Replace tree-shape expectations with catalog, relationship, and asset validation |
| `src/sampleLibrary/` | New isolated catalog, search, UI, preview, and loading modules |

Prefer small focused components. `SampleBrowser.tsx` should coordinate state; it should not contain manifest parsing, ranking, canvas drawing, and document-loading code in one file.

## Test plan

### Unit tests

- Catalog accepts the valid V1 fixture and rejects unknown schema versions.
- Duplicate IDs/files, missing files, dangling relationships, and invalid status-specific metadata fail validation.
- Every manifest waveform parses through `parseCodeToDiagram()`.
- Search normalization, aliases, token intersection, field weighting, and stable tie-breaking behave deterministically.
- Category/protocol/difficulty/status/kind filters compose correctly.
- Incorrect samples require visible violation metadata and a valid pair when specified.
- Preview cache is bounded and stale requests cannot overwrite a newer selection.
- `Edit a copy` clears file handles and sample read-only state.
- Read-only session rejects representative mutations at the store boundary if that mode ships.

### Component tests

- Opening the browser focuses search; Escape closes; focus returns to the opener.
- Tab focus is trapped while the modal is open.
- Search, category selection, filters, clear filters, empty state, and result counts render correctly.
- Selecting a row updates details and preview without changing the editor diagram.
- Incorrect status is conveyed by text/icon as well as color.
- Dirty-document confirmation gates Read/Edit actions, not preview selection.
- Load errors render inline and allow retry.
- Narrow layout navigates result -> detail -> back without losing query/filter state.

### Integration and end-to-end tests

- Browse from File menu, search `pready`, preview APB, and edit a copy.
- Preview several samples quickly and verify only the final selection is shown.
- Open an invalid lesson and navigate to its paired correct lesson.
- Attempt keyboard, canvas, inspector, source-code, undo, and paste mutations in read-only mode.
- Save an editable copy and verify the bundled asset is not overwritten.
- Run at desktop and narrow viewport sizes.
- Production build serves catalog and nested assets correctly under a non-root Vite base URL.

### Content review checklist

Every lesson must answer:

1. What one rule or failure mode does this teach?
2. Which edge/cycle in the waveform demonstrates it?
3. Are all signal values internally consistent?
4. Is the wording original and traceable to a reference?
5. Is `Correct`, `Incorrect`, `Corner case`, or `Conceptual` accurate?
6. Does an invalid trace state the expected correction?
7. Does the sample exercise at least one declared Waves GUI feature tag?
8. Is the diagram small enough to understand without horizontal/vertical hunting?

## Accessibility requirements

- Reuse or extract the focus-trap/restore pattern already present in `ExportDialog` rather than creating incompatible modal behavior.
- Give the dialog, category navigation, result list, selected result, status, preview, and errors accessible names.
- Support Escape to close, Tab/Shift+Tab focus cycling, and Enter/Space activation.
- Result rows must be real buttons or links; hover cannot be required.
- Preserve a visible focus indicator in all themes.
- Do not rely on color for status or selection.
- Respect reduced motion; the browser requires no decorative animation.
- At narrow widths, maintain a minimum practical touch target and avoid horizontal page scrolling.

## Performance and security constraints

- Catalog load is a same-origin static fetch and must respect `import.meta.env.BASE_URL` as existing sample loading does.
- Parse only the selected waveform; never mount dozens of canvas renderers.
- Keep all sample/reference URLs declarative. If external references are clickable, use the existing online-link confirmation policy or an equivalent explicit warning.
- Treat catalog and waveform JSON as untrusted input even though bundled: validate metadata and keep using the existing diagram parser/sanitization path.
- Do not allow manifest content to inject HTML, CSS, or remote assets.
- Measure before adding `react-window` or another runtime dependency.

## Release and migration strategy

1. Land catalog types, validation, and conversion of existing samples with no UI change.
2. Land browser UI behind the existing Samples entry and keep the flyout available for one short review cycle if necessary.
3. Switch the File menu to `Browse samples...` and remove the flyout code/CSS once parity tests pass.
4. Add curriculum assets in domain-sized pull requests.
5. Add favorites/recents only after IDs are stable.

No catalog change should silently rename a stable ID. If a rename is unavoidable after favorites/recents ship, add a manifest alias/migration map.

## Definition of done for Phase 1

- The editor shows no permanently expanded sample hierarchy.
- The browser is usable with keyboard, mouse, and narrow/touch layout.
- Search covers title, protocol, signals, concepts, keywords, and summary.
- Category, protocol, difficulty, status, and kind filters work together.
- Preview does not mutate or replace the open editor document.
- Waveform assets load only on selection/open.
- `Edit a copy` cannot overwrite a bundled sample or reuse an unrelated file handle.
- Invalid samples are unmistakable and explain the rule, location, expected behavior, and paired correction.
- Existing 15 samples remain discoverable and parse successfully.
- The representative vertical slice covers correct, incorrect, and fine-timing content.
- Unit, component, integration, accessibility, and production-base-path tests pass.

## Main risks and mitigations

| Risk | Mitigation |
|---|---|
| Read-only mode appears locked but a mutation path remains | Guard at store boundaries and test all input paths; defer read-only editor mode if incomplete |
| Protocol content is visually plausible but wrong | Require references, paired review, assertions/checks, and small single-rule diagrams |
| Catalog schema becomes over-designed | Version V1, keep required fields focused, and add optional fields only for a concrete UI use |
| Browser becomes a second complex application | Keep Phase 1 to search/filter/list/detail/preview/open; defer progress and quizzes |
| Hundreds of previews hurt startup/rendering | Lazy catalog load, one selected preview, bounded cache, optional generated thumbnails |
| Study-oriented topics are mistaken for implementation claims | Label advanced-protocol paths as study; distinguish concepts from implemented artifacts |
| Asset reorganization breaks deployed base paths | Keep old paths during behavior migration and test non-root production URLs |

## Recommended first executable action

Implement Phase 0 as one vertical-slice pull request: introduce `catalog.v1.json`, validate and migrate the existing 15 entries without moving files, then add the three representative lessons. This resolves the data contract and proves that correct, incorrect, and fine-timing content can share one browser before substantial UI or content work begins.
