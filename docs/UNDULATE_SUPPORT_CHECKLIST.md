# Undulate Support Checklist

Status: implementation audit

Last audited: 2026-07-27

Target upstream revision:
[`c8da7d48c48fc0bbc90113b6913611132bd96c01`](https://github.com/LudwigCRON/undulate/tree/c8da7d48c48fc0bbc90113b6913611132bd96c01)

This is the current implementation audit for `waves-gui`. It compares the
implementation and automated tests with Undulate's pinned documentation and
examples. The classification policy, delivery rules, and authoritative working
contract live in
[`UNDULATE_SUPPORT_PLAN.md`](./UNDULATE_SUPPORT_PLAN.md).

## Status legend

- [X] Supported: imported, represented, rendered, and exported with automated
  coverage unless a narrower scope is stated.
- [ ] Partial: a useful subset works, but the documented Undulate feature is
  not complete.
- [ ] Unsupported: unavailable in the current implementation. Unless the item
  is explicitly marked **Out of scope**, the main plan classifies it as WIP.
- [ ] Out of scope: intentionally not planned.
- [ ] Round-trip risk: currently accepted without an error but not preserved.
  Treat this as unsupported until validation blocks it or the bridge preserves
  it.

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
- [ ] Unsupported: styled signals, long node
  identifiers, YAML, TOML, relaxed JSON/JSONML, and opaque preservation.
- [ ] Out of scope: register diagrams and execution of Python-like analogue
  expressions.

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

### Partial or unsupported

- [ ] Partial: Undulate JSON is supported, but only the schema subset listed
  in this document. This is not full Undulate JSON compatibility.
- [ ] Unsupported: YAML input and output.
- [ ] Unsupported: TOML input and output.
- [ ] Partial: changed or newly inserted values follow the retained document's
  detected style, but byte-for-byte source preservation is not promised.
- [ ] Unsupported: opaque preservation of unknown Undulate fields.
- [X] Unknown fields on ordinary digital signals and unknown top-level fields
  route through the Undulate classifier and are rejected with revision-pinned
  object paths.

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

- [ ] Unsupported: Undulate long node identifiers.
- [ ] Unsupported: Undulate-only edge markers `#` and `*` and the complete
  extended path set as structured annotations.
- [ ] Unsupported: the Undulate `edges` plural field. The shared WaveDrom
  `edge` field is supported.
- [X] The plural `edges` field and known extended edge/node forms are detected
  and rejected as WIP before import.

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

- [ ] Partial: repeat is deliberately exported as the semantically equivalent
  expanded sequence instead of preserving the original compact spelling.
- [ ] Partial: there is no global Sub-Steps toolbar control; the inspector
  exposes the document resolution and exact per-cell values.
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

- [ ] Partial: step snapping remains the default for annotations created in
  the GUI, but can be disabled per annotation.
- [ ] Partial: annotations are limited to 1000 objects and text is limited to
  2000 characters.
- [ ] Partial: colors are deliberately limited to local hex, `rgb()`, and
  `rgba()` values; remote resources, gradients, CSS variables, and arbitrary
  CSS are rejected.
- [ ] Partial: stroke width is bounded to 0..32 and dash arrays to 1..16
  finite values in the 0..1000 range.

### Unsupported

- [ ] Partial: JSON-created structured arrows can be edited in the inspector;
  direct canvas creation and draggable anchor handles remain to be added.
- [ ] Unsupported: `font-size` and other text styles.
- [ ] Unsupported: `text_background`.
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
- [X] Sampled cells have a dedicated inspector point editor for adding,
  removing, and editing normalized offsets and values.
- [X] Shared analogue geometry in the live canvas, local render, SVG, PNG,
  and JPEG.
- [X] Explicit validation errors for non-finite values, malformed samples,
  value-count mismatches, and unsupported analogue fields.

### Partial

- [ ] Partial: analogue `repeat` is recognized but rejected as WIP until its
  expansion has a proven semantic-equivalence and export contract.
- [ ] Partial: sampled `a` cells are accepted only when their time coordinates
  already use the lossless inclusive 0..1 cell range. Other finite timebases
  are rejected until an explicit conversion model exists.
- [ ] Partial: imported voltage context starts at Ludwig's 0..1.8 defaults
  because `VDDA`/`VSSA` are renderer context rather than JSON fields. Custom
  GUI rails are saved in the app document; Undulate export resolves expressions
  to numeric values/points because upstream JSON cannot carry those custom
  rails.
- [ ] Partial: `rnd()` is deterministic in the browser so the diagram remains
  stable across edits and exports; Ludwig's Python renderer generates fresh
  random values.
- [X] Imported analogue values outside ±1,000,000,000, negative slew, and
  `vscale` outside 0.25..16 are rejected before normalization; GUI-authored
  values may still use bounded controls.
- [ ] Partial: overlays are inferred from consecutive analogue lanes; there is
  no explicit overlay-group object or polished ambiguous-curve picker.
- [ ] Partial: the upstream four-wave overlay limit is not enforced as an
  interoperability constraint.
- [X] Sample points can be edited through Undulate JSON and the dedicated
  inspector point editor.

### Unsupported

- [ ] Unsupported: general Python expressions, arbitrary list comprehensions,
  attribute access, assignment, user-defined variables/functions, and code
  execution outside the safe documented subset.
- [ ] Unsupported: per-signal `stroke`, `fill`, `stroke-width`,
  `stroke-dasharray`, and `font-size`.
- [ ] Unsupported: mixed metastability/impulse symbols inside analogue wave
  strings as true Undulate states. Do not rely on `m`, `M`, `i`, or `I`.
- [ ] Out of scope: evaluating imported Python or reproducing Undulate's
  unrestricted expression runtime.

Upstream references:
[analogue cells](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_ana_step1.rst),
[overlays and style overloading](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_ana_step2.rst).

## 6. Styling

### Supported

- [X] App-native themes, accent color, canvas color, and existing WaveDrom bus
  palette choices affect browser rendering.
- [X] Typed annotations accept bounded local `fill`, `stroke`,
  `stroke-width`, and `stroke-dasharray` overrides.
- [X] Generated SVG text is escaped and output is sanitized.

### Unsupported

- [ ] Unsupported: Undulate per-object CSS-style fields on signals and edges.
- [ ] Unsupported: imported `font-size` and `text_background`.
- [ ] Unsupported: remote resources, gradients, CSS variables, named colors,
  and arbitrary CSS in annotation style values.
- [ ] Unsupported: global Undulate CSS files and renderer style overloading.
- [ ] Unsupported: lossless translation between app-native visual settings
  and Undulate style fields.

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

- [ ] Out of scope: PDF export.
- [ ] Unsupported: PostScript or EPS export.
- [ ] Unsupported: terminal rendering.
- [ ] Unsupported: invoking Undulate's Python/Cairo renderer locally.
- [ ] Out of scope: pixel-identical output with Undulate's SVG or Cairo
  renderers.

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

- [ ] Partial: the feature-loss summary counts supported annotations, analogue
  lanes, and extended digital signals. It cannot count unknown fields because
  opaque data is not preserved.
- [ ] Partial: the compatibility report covers typed extension objects, not
  every documented Undulate property.

## 9. Intentionally out of scope

- [ ] Undulate register diagrams.
- [ ] Executing Python-like analogue expressions.
- [ ] Embedding Python, Pyodide, Cairo, or a server renderer.
- [ ] Byte-for-byte source round-trip.
- [ ] Pixel-identical reproduction of every Undulate renderer.

## 10. Highest-priority gaps

- [X] **P0 — Close silent-loss paths.** Timing-only auto-detection, bounded
  fraction rejection, and extension-removal conversion are covered.
- [X] **P0 — Add upstream round-trip fixtures.** Import and re-export pinned
  examples for every feature marked supported.
- [X] **P1 — Extended digital timing.** The integer-tick model, repeat
  expansion, variable periods, duty cycles, digital slew, and loss-safety
  gates are implemented.
- [ ] **P1 — Complete annotation authoring.** Inspector editing now covers
  structured-arrow shapes, node/coordinate anchors, labels, offsets, and basic
  stroke styling. Add direct canvas creation and draggable anchor handles.
- [ ] **P2 — Extend safe normalized styling.** Annotation colors, widths, and
  dashes already use strict allowlists. Add signal and edge styles, bounded
  font sizes, and text backgrounds.
- [ ] **P2 — Opaque preservation.** Retain safe unknown declarative data and
  report when an edit invalidates it.
- [ ] **P3 — Additional formats and outputs.** Add safe YAML/TOML adapters and
  evaluate PDF only after the semantic model is stable.

## 11. Audit evidence in this repository

Primary implementation:

- `src/codePanel/json5Source.ts`
- `src/codePanel/codeSync.ts`
- `src/shell/FileOperations.ts`
- `src/undulateBridge/undulateJSON.ts`
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
- [ ] Decide whether analogue cell painting belongs in the shared Draw tool or
  a dedicated Undulate tool.
- [ ] Add task-oriented samples that demonstrate each supported Undulate
  feature, in addition to the existing protocol-oriented samples.
