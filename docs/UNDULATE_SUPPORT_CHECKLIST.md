# Undulate Support Checklist

Status: implementation audit

Last audited: 2026-07-30

Actionable implementation progress: **172 / 172 (100%)**

Target upstream revision:
[`c8da7d48c48fc0bbc90113b6913611132bd96c01`](https://github.com/LudwigCRON/undulate/tree/c8da7d48c48fc0bbc90113b6913611132bd96c01)

This is the current implementation audit for `waves-gui`. It compares the
implementation and automated tests with Undulate's pinned documentation and
examples. The classification policy, delivery rules, and authoritative working
contract live in
[`UNDULATE_SUPPORT_PLAN.md`](./UNDULATE_SUPPORT_PLAN.md).

## Status legend

- **Supported:** imported, represented, rendered, and exported with automated
  coverage unless a narrower scope is stated.
- **Partial:** a useful subset works, but the documented Undulate feature is
  not complete.
- **Unsupported:** unavailable in the current implementation. Unless the item
  is explicitly marked **Out of scope**, the main plan classifies it as WIP.
- **Out of scope:** intentionally not planned.
- **Round-trip risk:** currently accepted without an error but not preserved.
  Treat this as unsupported until validation blocks it or the bridge preserves
  it.

Documented resource and numeric bounds count as supported safety guarantees
when over-limit input is rejected explicitly rather than silently changed.

## Support contract

The product goal is semantic compatibility with every documented declarative
waveform feature at the pinned Undulate revision. Compatibility has three
levels:

1. **Modeled and rendered:** the GUI understands, edits, renders, and exports
   the feature.
2. **Safely preserved:** safe declarative data that is not yet modeled, or was
   introduced by a newer Undulate revision, round-trips opaquely with an
   explicit compatibility report.
3. **Intentionally rejected:** unsafe or permanently excluded behavior is
   blocked with a specific explanation and is never silently discarded.

The only permanent exclusions are:

- Register diagrams.
- Arbitrary code execution. The bounded documented expression subset remains
  supported.
- Unsafe remote resources and arbitrary CSS execution.
- Exact implementation/backend reproduction, including embedding or invoking
  Undulate's Python/Cairo renderer and promising pixel-identical output.

Safe declarative features at the pinned revision are certified as modeled,
opaque-preserved, or intentionally rejected. Completion percentages count
supported items against supported plus actionable unchecked items; legend
examples and permanent exclusions are not counted.

## Executive summary

- [X] Strict Undulate JSON for the supported subset.
- [X] Plain text, vertical-line, and horizontal-line annotations.
- [X] Numeric and safe Ludwig-expression analogue `s`/`c` cells, plus explicit
  or documented expression-backed sampled `a` cells.
- [X] Analogue `slewing`, `vscale`, consecutive overlays, and label `order`.
- [X] Browser-native live rendering plus SVG, PNG, and JPEG export.
- [X] Undo/redo, autosave, JSON editing, compatibility reporting, and the
  three-action disable flow for supported extension content.
- [X] A semantic waveform-value palette exposes extended digital states by
  meaning, preview, and JSON symbol without expanding every state inline.
- [X] Ordinary and mixed extended digital lanes include integer-tick repeat,
  per-cell periods, clock duty arrays, and digital slew.
- [X] Styled signals and relaxed JSON/JSONML, including `.jsonml` File Open,
  retained-handle Save, comments, unquoted keys, single quotes, and trailing
  commas. Safe opaque preservation and JSON, YAML, and TOML semantic
  interchange are supported for the schema subset listed here.
- **Permanent exclusions:** register diagrams and arbitrary code execution.
  Safe documented analogue expressions remain supported.

## 1. File formats and interchange

### Supported

- [X] Strict JSON input through File Open and the code editor.
- [X] Strict JSON output for newly generated documents.
- [X] WaveDrom JSON5 input through File Open and the code editor, including
  line/block comments, unquoted keys, single-quoted strings, and trailing
  commas.
- [X] Retained JSON5 source is updated through a concrete syntax tree so
  comments, key order, quoting, and surrounding formatting survive supported
  GUI edits, undo/redo, recovery drafts, and Save.
- [X] Comments orphaned by a deliberately removed property or array entry are
  relocated to the nearest surviving container instead of being discarded.
- [X] Automatic Undulate detection when `annotations` or an `analogue` signal
  is present.
- [X] The code editor stays in Undulate JSON while the extensions toggle is
  enabled, and a retained Undulate source file remains Undulate on save.
- [X] The JSON editor, document model, live canvas, and local render update
  each other without a WaveDrom-only conversion.
- [X] Supported Undulate content participates in dirty-state tracking,
  autosave, undo, and redo.
- [X] Known WIP, unsupported-by-design, invalid, and unknown Undulate
  properties are rejected before import instead of being silently discarded.
- [X] JSON editor and File Open rejection leave the current diagram, history,
  dirty state, and retained file handle unchanged.
- [X] JSON validation follows the active format: Undulate-only digital states
  are accepted in Undulate mode and reported as errors in WaveDrom mode.
- [X] Online WaveDrom Editor export requires an explicit warning that the
  exported JSON is sent to `wavedrom.com`; cancelling sends nothing.
- [X] Safe Undulate YAML 1.2 input through File Open and the code editor,
  including upstream mapping-key signal names, nested mapping groups,
  dependency edges, annotations, and `(x, y)` coordinate anchors.
- [X] Canonical Undulate YAML output through Save and Export. Opened `.yaml`
  and `.yml` files remain YAML after GUI and code-editor changes.
- [X] The Undulate code-panel toolbar can explicitly convert a valid document
  between JSON and YAML syntax. Conversion preserves diagram semantics,
  changes the subsequent Save format, and detaches an incompatible retained
  file handle so the original file is not overwritten with the wrong syntax.
- [X] YAML import rejects duplicate keys, aliases/anchors, explicit tags,
  merge keys, unsafe object keys, oversized documents, excessive node counts,
  and excessive nesting before schema validation.
- [X] YAML export rejects duplicate or reserved signal names that cannot be
  represented losslessly as mapping keys.
- [X] Safe Undulate TOML input through File Open and the code editor, including
  upstream dotted-key signals, nested tables/groups, arrays of annotation
  tables, dependency edges, and coordinate anchors.
- [X] Canonical Undulate TOML output through Save and Export. Opened `.toml`
  files remain TOML after GUI and code-editor changes.
- [X] TOML import rejects duplicate and unsafe keys, dates/times, non-finite
  values, lossy integers, oversized documents, excessive value counts, and
  excessive nesting before schema validation.
- [X] The Undulate code-panel toolbar converts valid documents among all three
  supported interchange syntaxes: JSON, YAML, and TOML.

### Partial or unsupported

- [X] Schema certification: every safe declarative feature at the pinned
  Undulate revision is classified as modeled, opaque-preserved, or
  intentionally rejected. Permanent exclusions remain register diagrams,
  arbitrary code execution, unsafe remote/CSS resources, and exact
  backend reproduction. Evidence:
  `tests/fixtures/undulate/property-matrix.json`,
  `tests/fixtures/undulate/certification-corpus.json`,
  `src/undulateBridge/manifestConsistency.test.ts`, and
  `src/undulateBridge/certificationCorpus.test.ts`.
- [X] YAML supports semantic import/edit/export for the same validated
  Undulate subset as JSON. Syntax-tree updates retain comments, mapping and
  sequence order, and existing scalar quoting during GUI edits. Anchors,
  aliases, merge keys, and explicit tags remain rejected as unsafe syntax.
- [X] TOML supports semantic import/edit/export for the same validated
  Undulate subset as JSON. Existing scalar edits retain comments,
  dotted/table layout, and compatible quote style. Structural changes use
  deterministic canonical TOML and relocate source comments instead of
  silently deleting them.
- [X] Changed values follow the retained JSONML, YAML, or TOML document's
  detected local style where representable; newly inserted or structurally
  changed values use deterministic canonical syntax. Byte-for-byte source
  identity is not promised.
- [X] Safe unknown top-level, config, head/foot, signal, and annotation fields
  are preserved opaquely, re-exported verbatim, and reported before export.
  Deleting an attached signal or annotation produces an explicit orphan warning.
- [X] Unsafe, oversized, executable/resource-bearing, WIP, and
  unsupported-by-design fields are rejected with revision-pinned object paths.

Upstream references:
[supported syntax](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/supported_syntax.rst),
[JSONML parser](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/src/undulate/parsers/jsonml.py),
[YAML parser](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/src/undulate/parsers/yaml.py),
[TOML parser](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/src/undulate/parsers/toml.py).

## 2. Shared digital waveform features

### Supported

- [X] Logic states `0`, `1`, unknown `x`/`X`, high-impedance `z`/`Z`, pull-up
  `u`/`U`, and pull-down `d`/`D`.
- [X] Continuation with `.`.
- [X] Clock states `p`, `P`, `n`, and `N`.
- [X] Bus states `x`, `X`, `=`, and color indices `2` through `9`.
- [X] Bus data labels supplied as space-delimited strings or arrays; string
  input exports deterministically as the canonical array form.
- [X] Lane gaps with `|` on bit and vector lanes, including the canvas,
  local Undulate render, and image exports.
- [X] Explicit repeated transitions represented by the app as glitches.
- [X] Blank spacer rows.
- [X] Nested groups in the shared WaveDrom JSON array form.
- [X] Scalar `phase`.
- [X] Scalar `period` round-trip for ordinary bit and vector lanes.
- [X] WaveDrom-compatible single-character node strings.
- [X] WaveDrom-compatible `edge` dependency strings and labels.
- [X] Supported WaveDrom sub-cycle marker syntax on scalar bit lanes.
- [X] Diagram `hscale`, supported skins, headers, footers, ticks, and tocks.
- [X] Mixed logic and data cells (`x`, `X`, `=`, and `2`–`9`) in one digital
  lane.
- [X] Metastability states `m` and `M`, resolving to zero and one.
- [X] Impulse states `i` and `I`.
- [X] Held clock-edge states `h`, `H`, `l`, and `L`, including uppercase edge
  arrows.
- [X] Undulate-only digital paint states are available from a categorized
  value palette with semantic labels, waveform previews, raw symbols, recent
  choices, and the active extended brush shown on the toolbar.

### Partial or unsupported

- [X] Undulate expanded long node identifiers use `#` waveform placeholders
  and trailing names, resolve in dependency edges and structured annotation
  anchors, and round-trip semantically.
- [X] Undulate dependency-edge endpoint markers `#` (square) and `*` (circle)
  render in the live canvas and SVG/image exports and round-trip semantically.
- [X] Structured annotation arrows expose none/arrow/square/circle endpoint
  choices in the inspector and render them in the canvas and SVG/image exports.
- [X] Undulate's plural `edges` field imports whitespace-tolerant dependency
  paths, normalizes them for live editing/rendering, and exports canonically as
  `edges`. The shared WaveDrom `edge` spelling remains accepted on import.
- [X] All documented straight, curved, mixed, and orthogonal middle paths are
  accepted through the plural-field adapter.
- [X] Marker edges participate in Undulate detection, hide/preserve, explicit
  removal, undo, and WaveDrom compatibility reporting.

Upstream references:
[digital symbols](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_dig_step1.rst),
[clocks](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_dig_step2.rst),
[buses](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_dig_step3.rst),
[groups](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_dig_step4.rst).

## 3. Extended digital timing

### Supported or partial

- [X] Scalar `phase` is preserved.
- [X] Scalar `period` is preserved on ordinary digital lanes.
- [X] Digital `repeat` expands to a canonical equivalent cell sequence.
- [X] A bounded integer timebase (up to 1024 ticks per step) represents
  fractional periods, phase, and duty boundaries without accumulated drift.
- [X] Per-cell `periods`, scalar/array duty cycle, and digital slew render in
  the canvas and SVG/image export and are editable in the signal inspector.

### Unsupported and round-trip risks

- [X] Compact digital `repeat` spelling is retained while the expanded cell
  states remain unchanged; edits that invalidate it export the canonical
  expanded sequence without semantic loss.
- [X] A global Sub-Steps toolbar control exposes the integer document
  resolution and rescales all periods, duty boundaries, and phase exactly;
  lossy resolutions are rejected instead of rounded.
- [X] Timing-only JSON is automatically detected from `repeat`, `periods`,
  duty-cycle, or digital `slewing` fields.
- [X] Values that cannot fit within the 1024-tick ceiling are rejected before
  import instead of being quantized.

Upstream reference:
[period, duty cycle, phase, and repeat](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_dig_step5.rst).

Implementation design:
[`UNDULATE_FINE_TIMING_DESIGN.md`](./UNDULATE_FINE_TIMING_DESIGN.md).

## 4. Annotations

### Supported

- [X] Plain text annotations with finite numeric `x` and `y`.
- [X] Vertical line annotations with `shape: "|"` and finite numeric `x`.
- [X] Horizontal line annotations with `shape: "-"` and finite numeric `y`.
- [X] Full-span global time compression with `shape: "||"` and finite numeric
  `x`.
- [X] Safe annotation `fill`, `stroke`, `stroke-width`, and
  `stroke-dasharray` on typed text, line, and global-compression annotations.
- [X] Creation through dedicated Text, V line, H line, and Compress tools.
- [X] Selection, property editing, deletion, undo, and redo.
- [X] Rendering in the live canvas, local render, SVG, PNG, and JPEG.
- [X] Text is escaped in generated SVG.
- [X] Supported annotations within the app's bounds round-trip through
  Undulate JSON.
- [X] Fractional `x` and `y` coordinates are preserved through import,
  inspector editing, local rendering, and Undulate export.
- [X] Selected annotations can be dragged directly; arrow keys nudge and
  Shift provides fine movement.
- [X] Vertical lines, horizontal lines, and global compression accept
  independent `from`/`to` bounds as finite indices or percentages from 0% to
  100%, with inspector editing and semantic round-trip coverage.
- [X] Structured arrows accept node anchors (with offsets) or numeric/percent
  coordinate anchors, connector shapes, labels, label offsets, and safe style.
- [X] Structured arrows render in the live canvas and SVG/image exports and
  round-trip through Undulate JSON.

### Partial

- [X] Annotation creation exposes a Snap On/Off control before placement;
  snapping remains the default and can also be changed per annotation.
- [X] Intentional safety boundary: a document may contain at most 1000
  annotations, and annotation text may contain at most 2000 characters.
  Over-limit input is rejected explicitly rather than truncated.
- [X] Colors accept local hex, bounded `rgb()`/`rgba()`, and a reviewed
  allowlist of CSS named colors. Remote resources, gradients, CSS variables,
  `currentColor`, and arbitrary CSS remain rejected.
- [X] Intentional safety boundary: `stroke-width` (line thickness) is bounded
  to 0..32. `stroke-dasharray` (alternating painted and gap lengths, such as
  `[6, 3]`) accepts 1..16 finite values, each in the 0..1000 range. Over-limit
  input is rejected explicitly.
- [X] Annotation font sizes accept finite CSS absolute, font-relative, and
  percentage units that normalize deterministically into the safe 6px to 96px
  range; export uses canonical pixels.

### Unsupported

- [X] Structured arrows support inspector editing, direct two-click canvas
  creation, and draggable endpoint handles.
- [X] Annotation text and arrow labels support safe local generic
  `sans-serif`, `serif`, or `monospace` families and numeric weights 100..900;
  arbitrary or remotely loaded fonts remain rejected.
- [X] Malformed structured arrow anchors are rejected before import.
- [X] Over-limit annotation counts, text, and coordinates are rejected before
  normalization can truncate or clamp them.

Upstream references:
[annotation tutorial](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_ann_step2.rst),
[WaveDrom-compatible edges](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_ann_step1.rst).

## 5. Analogue waveforms

### Supported

- [X] Analogue lanes as a distinct editable signal type.
- [X] Numeric step cells using Undulate `s`.
- [X] Numeric capacitive cells using Undulate `c`.
- [X] Explicit sampled arbitrary cells using Undulate `a` with finite
  `[time, value]` pairs.
- [X] Hold cells represented by the initial `0`/`1` level and `.`.
- [X] Bounded finite sample data, with at most 4096 points per cell.
- [X] Bounded analogue voltage range in the app inspector.
- [X] Safe scalar expressions using `VDDA`, `VSSA`, `pi`, arithmetic, and
  Ludwig's documented math-function allowlist. No JavaScript or Python is
  executed.
- [X] The documented `[(t, expression) for t in time]` curve form, sampled to
  65 editable points with per-cell `time` and `Tmax`.
- [X] Document-wide `VSSA` and `VDDA` inspector controls reevaluate all
  expression-backed cells as one undoable edit.
- [X] Original supported expressions are retained for reevaluation and
  round-trip while the document uses Ludwig's default 0..1.8 rails.
- [X] Numeric `slewing` for step geometry.
- [X] Bounded `vscale` from 0.25 through 16.
- [X] Consecutive analogue overlay chains.
- [X] Overlay label `order` values 0 through 4.
- [X] Analogue creation, cell selection, transition/value editing, and
  undo/redo.
- [X] Analogue `repeat` imports with upstream value-cycling semantics and
  exports as a canonical expanded sequence.
- [X] Sampled cells have a dedicated inspector point editor for adding,
  removing, and editing normalized offsets and values.
- [X] Shared analogue geometry in the live canvas, local render, SVG, PNG,
  and JPEG.
- [X] Explicit validation errors for non-finite values, malformed samples,
  value-count mismatches, and unsupported analogue fields.
- [X] Safe normalized per-signal `stroke`, `fill`, `stroke-width`,
  `stroke-dasharray`, and pixel `font-size` import, inspector editing,
  rendering, image export, and semantic round-trip.

### Partial

- [X] Compact analogue `repeat` spelling and its value cycle are retained while
  imported cells remain unchanged; cell edits invalidate the compact source
  and export the canonical expanded sequence.
- [X] Sampled `a` cells accept ascending finite time coordinates on any finite
  domain. An explicit affine timebase maps them to editable 0..1 offsets and
  reconstructs the original domain on export.
- [X] Imported and GUI-authored `VDDA`/`VSSA` rails are preserved in
  namespaced app-owned document metadata. Waves GUI restores that context on
  reopen; strict upstream Undulate export omits the app metadata and resolves
  affected expressions to portable numeric values or points.
- [X] The analogue inspector exposes app-owned stable/refresh `rnd()` seed
  behavior. Results remain deterministic across renders; Refresh changes the
  seed only on an explicit user action and reevaluates random expressions.
  JSON, YAML, and TOML retain the seed in the namespaced app metadata, while
  strict upstream export resolves random expressions to portable values.
- [X] Imported analogue values outside ±1,000,000,000, negative slew, and
  `vscale` outside 0.25..16 are rejected before normalization; GUI-authored
  values may still use bounded controls.
- [X] Consecutive imported overlays become explicit named overlay-group
  objects; the inspector creates, extends, reports, and dissolves group
  membership while export derives Undulate's consecutive flags.
- [X] The upstream four-wave overlay limit is enforced in the GUI and during
  validation as an interoperability constraint.
- [X] Sample points can be edited through Undulate JSON and the dedicated
  inspector point editor.

### Unsupported

- **Permanent exclusion:** general Python expressions, arbitrary list
  comprehensions,
  attribute access, assignment, user-defined variables/functions, and code
  execution outside the safe documented subset.
- [X] Mixed metastability/impulse symbols inside analogue wave strings are
  modeled as true cells: `m`/`M` oscillate and resolve to the lower/upper rail,
  while `i`/`I` render downward/upward impulses and return to their base rail.
  They are available in the analogue palette and inspector and share canvas
  and SVG/export geometry.
- The safe documented expression subset remains the supported alternative to
  executing imported Python.

Upstream references:
[analogue cells](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_ana_step1.rst),
[overlays and style overloading](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_ana_step2.rst).

## 6. Styling

### Supported

- [X] App-native themes, accent color, and canvas color affect editor chrome
  and browser presentation without becoming a third document style format.
  WaveDrom fields plus Undulate extensions remain the document model.
- [X] Typed annotations accept bounded local `fill`, `stroke`,
  `stroke-width`, `stroke-dasharray`, and pixel `font-size` overrides.
- [X] Digital, vector, and analogue signals accept the same bounded local style
  fields. Vector fill and value-label font size are rendered semantically;
  arbitrary CSS is never evaluated.
- [X] Text and arrow-label backgrounds follow Undulate's default-on
  `text_background` behavior and can be disabled per annotation.
- [X] Generated SVG text is escaped and output is sanitized.

### Unsupported

- [X] WaveDrom-compatible `edges` remain the upstream fixed-style string
  shorthand. A GUI action promotes any valid shorthand edge to an equivalent
  structured arrow annotation, where the safe normalized style fields are
  inspector-editable and round-trip through Undulate.
- [X] Normalized local signal styling includes the pinned safe color, fill,
  width, dash, font-size, generic font-family, and numeric font-weight fields.
  Font settings affect signal labels and vector values consistently in canvas
  and SVG/image exports. This does not introduce raw CSS support.
- **Permanent exclusion:** remote resources, raw style strings, selectors,
  arbitrary CSS values, global CSS files, CSS variables, and renderer style
  overloading that would execute or load unsafe content.

## 7. Rendering and exports

### Supported

- [X] Interactive browser canvas rendering.
- [X] Browser-local preview of the current Undulate JSON subset.
- [X] Local preview Fit, 100%, zoom, and scroll navigation.
- [X] SVG export from the app renderer.
- [X] PNG export at 1x, 2x, and 3x.
- [X] JPEG export at 1x, 2x, and 3x.
- [X] Copy as PNG and copy as SVG where browser clipboard support is
  available.
- [X] WaveDrom compatible-subset export with explicit findings for supported
  extension objects that cannot be represented.
- [X] Undulate JSON compatibility findings for converted annotations and
  analogue lanes.
- [X] Offline visual-conformance gate against pinned upstream SVGs for the
  extended digital alphabet, analogue step/capacitive cells, and an explicit
  sampled curve, with geometry-only normalization and failure diff artifacts.

### Unsupported

- [X] PDF export embeds a high-resolution app-rendered diagram in a
  standards-compliant single-page PDF without invoking an external backend.
- [X] EPS export uses a self-contained Level 2 PostScript document with an
  ASCIIHex/DCT-encoded high-resolution app render and no external resources.
- [X] Terminal-text export renders grouped digital, vector, and analogue lanes
  plus annotation notes as deterministic UTF-8 text.
- **Permanent exclusion:** invoking or embedding Undulate's Python/Cairo
  renderer locally or through a server, and promising pixel-identical output
  with Undulate's SVG or Cairo backends.

Upstream reference:
[Undulate README output formats](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/README.md).

## 8. Mode and feature-loss behavior

### Supported

- [X] Document-level Undulate extensions toggle.
- [X] A distinct final `UNDULATE` group in the vertical edit rail.
- [X] Extension creation and editing controls are hidden while disabled.
- [X] Existing extension objects are hidden and locked without changing their
  JSON when **Hide features and preserve JSON** is chosen.
- [X] **Cancel** leaves the mode and document unchanged.
- [X] **Remove Undulate features** deletes supported annotations and analogue
  lanes, strips digital fine timing, and preserves compatible scalar phase or
  uniform integer period as one undoable edit.
- [X] Enabling and disabling the mode participates in document history.
- [X] Turning the mode off opens the three-action confirmation when supported
  annotations, analogue lanes, or Undulate-only digital wave characters are
  present; ordinary WaveDrom-only documents turn off without an unnecessary
  prompt.
- [X] WaveDrom export reports supported annotations and analogue lanes as
  incompatible rather than silently claiming lossless output.

### Partial

- [X] The feature-loss summary covers annotations, analogue lanes, extended
  timing/states, expanded nodes, marked edges, signal styles, explicit overlay
  groups, and all preserved or orphaned opaque fields for the selected target.
- [X] The compatibility report covers every accepted typed extension category,
  all safe opaque properties, and orphaned opaque data. The revision-pinned
  property manifest classifies every documented property before import, so
  rejected WIP, unsafe, and permanent-exclusion fields cannot become silent
  export loss.

## 9. Intentionally out of scope

- Register diagrams.
- Arbitrary code execution, including unrestricted imported Python.
- Unsafe remote resources and arbitrary CSS execution.
- Exact implementation/backend reproduction, including embedding Python,
  Pyodide, Cairo, or a server renderer and promising pixel-identical output.

## 10. Highest-priority gaps

- [X] **P0 — Close silent-loss paths.** Timing-only auto-detection, bounded
  fraction rejection, and extension-removal conversion are covered.
- [X] **P0 — Add upstream round-trip fixtures.** Import and re-export pinned
  examples for every feature marked supported.
- [X] **P1 — Extended digital timing.** The integer-tick model, repeat
  expansion, variable periods, duty cycles, digital slew, and loss-safety
  gates are implemented.
- [X] **P1 — Complete annotation authoring.** Inspector editing covers
  structured-arrow shapes, node/coordinate anchors, labels, offsets, and basic
  stroke styling. The dedicated Undulate Arrow tool supports direct two-point
  canvas creation, and selected arrows expose draggable endpoint handles.
- [X] **P2 — Extend safe normalized styling.** Annotation and signal colors,
  widths, dashes, bounded font sizes, fills, and text backgrounds use strict
  allowlists. Styled edge intent uses Undulate's structured arrow annotations;
  shorthand `edges` can be promoted without rebuilding their anchors or label.
- [X] **P2 — Opaque preservation.** Safe unknown declarative fields are retained
  on root, config, head/foot, signal, and annotation objects. Orphaned fields
  are reported when their attached signal or annotation is deleted.
- [X] **P3 — Additional formats and outputs.** Safe semantic YAML and TOML
  import plus canonical export are implemented alongside JSON. Source-
  preserving mapping-format edits are explicitly deferred; evaluate PDF
  independently after the semantic model is stable.
- [X] **P4 — Source and secondary-output fidelity.** JSONML/YAML/TOML retain
  comments and compatible concrete syntax where practical. PDF, EPS, and
  terminal outputs use safe app-native implementations.

## 11. Audit evidence in this repository

Pinned schema certification (2026-07-30):

- Property matrix: `tests/fixtures/undulate/property-matrix.json`
- Provenance corpus: `tests/fixtures/undulate/certification-corpus.json`
- Consistency gate: `src/undulateBridge/manifestConsistency.test.ts`
- Parameterized corpus gate: `src/undulateBridge/certificationCorpus.test.ts`

Primary implementation:

- `src/codePanel/json5Source.ts`
- `src/codePanel/codeSync.ts`
- `src/shell/FileOperations.ts`
- `src/undulateBridge/undulateJSON.ts`
- `src/undulateBridge/undulateYAML.ts`
- `src/undulateBridge/undulateTOML.ts`
- `src/undulateBridge/mappingFormat.ts`
- `src/undulateBridge/types.ts`
- `src/shared/types.ts`
- `src/shared/analogue.ts`
- `src/shared/annotations.ts`
- `src/shared/compatibility.ts`
- `src/renderer/analogueGeometry.ts`
- `src/renderer/annotationLayout.ts`
- `src/renderer/renderHeadFoot.ts`
- `src/exportEngine/exportDimensions.ts`
- `src/exportEngine/exportSVG.ts`

Primary automated coverage:

- `src/codePanel/json5Source.test.ts`
- `src/codePanel/codeSync.test.ts`
- `src/shell/FileOperations.test.ts`
- `src/shell/soloDesk/soloDesk.test.ts`
- `src/undulateBridge/undulateJSON.test.ts`
- `src/undulateBridge/undulateYAML.test.ts`
- `src/undulateBridge/undulateTOML.test.ts`
- `src/undulateBridge/manifestConsistency.test.ts`
- `src/undulateBridge/certificationCorpus.test.ts`
- `src/undulateBridge/upstreamRoundTrip.test.ts`
- `src/undulateBridge/visualConformance.test.ts`
- `src/shared/store.test.ts`
- `src/shared/store/annotationActions.test.ts`
- `src/shared/compatibility.test.ts`
- `src/exportEngine/analogueExport.test.ts`
- `src/exportEngine/annotationExport.test.ts`
- `src/exportEngine/gapExport.test.ts`
- `src/exportEngine/headFootImageExport.test.ts`
- `tests/e2e/release.spec.ts`
- `tests/fixtures/undulate/property-matrix.json`
- `tests/fixtures/undulate/certification-corpus.json`
- `tests/fixtures/undulate/supported-roundtrip-cases.json`
- `tests/fixtures/undulate/visual/reference/`


## Product follow-ups

- [X] Add analogue lanes from the dedicated Undulate group.
- [X] Make selected analogue lanes available to the properties inspector.
- [X] Keep the selected lane and properties inspector attached across JSON
  edits that regenerate signal IDs, including safe path/name/type fallback.
- [X] Put direct analogue step value and transition editing at the top of the
  analogue inspector.
- [X] Add a dedicated sampled-curve/point editor for normalized offsets and
  values, including add and remove controls.
- [X] Keep analogue cell painting in a dedicated Undulate tool, with
  Hold/Step/Curve/Samples brushes, numeric target values, drag previews, and
  one-history-entry range commits. Keep Add analog and Analog paint as separate
  actions within the Undulate group, and select new lanes for detailed
  Inspector editing.
- [X] Task-oriented Undulate samples cover fine timing, analogue painting and
  overlays, structured annotations, expanded nodes, marked edges, extended
  states, and safe styling alongside the protocol-oriented samples.
