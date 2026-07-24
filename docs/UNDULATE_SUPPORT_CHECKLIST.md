# Undulate Support Checklist

Status: implementation audit

Last audited: 2026-07-24

Target upstream revision:
[`c8da7d48c48fc0bbc90113b6913611132bd96c01`](https://github.com/LudwigCRON/undulate/tree/c8da7d48c48fc0bbc90113b6913611132bd96c01)

This is the current support contract for `waves-gui`. It compares the
implementation and automated tests with Undulate's pinned documentation and
examples. The broader design and roadmap remain in
[`UNDULATE_SUPPORT_PLAN.md`](./UNDULATE_SUPPORT_PLAN.md).

## Status legend

- [x] Supported: imported, represented, rendered, and exported with automated
  coverage unless a narrower scope is stated.
- [ ] Partial: a useful subset works, but the documented Undulate feature is
  not complete.
- [ ] Unsupported: rejected or unavailable.
- [ ] Out of scope: intentionally not planned.
- [ ] Round-trip risk: currently accepted without an error but not preserved.
  Treat this as unsupported until validation blocks it or the bridge preserves
  it.

## Executive summary

- [x] Strict Undulate JSON for the supported subset.
- [x] Plain text, vertical-line, and horizontal-line annotations.
- [x] Numeric analogue `s`, `c`, and explicit sampled `a` cells.
- [x] Analogue `slewing`, `vscale`, consecutive overlays, and label `order`.
- [x] Browser-native live rendering plus SVG, PNG, and JPEG export.
- [x] Undo/redo, autosave, JSON editing, compatibility reporting, and the
  three-action disable flow for supported extension content.
- [ ] Partial: ordinary digital WaveDrom-compatible lanes and timing are
  available in Undulate JSON, but Undulate-only digital states and timing
  arrays are not.
- [ ] Unsupported: styled annotations/signals, global compression, Undulate
  annotation arrows, long node identifiers, YAML, TOML, relaxed JSON/JSONML,
  and opaque preservation.
- [ ] Out of scope: register diagrams and execution of Python-like analogue
  expressions.

## 1. File formats and interchange

### Supported

- [x] Strict JSON input through File Open and the code editor.
- [x] Strict JSON output through Save and Undulate JSON export.
- [x] Automatic Undulate detection when `annotations` or an `analogue` signal
  is present.
- [x] The code editor stays in Undulate JSON while the extensions toggle is
  enabled, and a retained Undulate source file remains Undulate on save.
- [x] The JSON editor, document model, live canvas, and local render update
  each other without a WaveDrom-only conversion.
- [x] Supported Undulate content participates in dirty-state tracking,
  autosave, undo, and redo.

### Partial or unsupported

- [ ] Partial: Undulate JSON is supported, but only the schema subset listed
  in this document. This is not full Undulate JSON compatibility.
- [ ] Unsupported: relaxed JSON/JSONML with comments or unquoted keys.
- [ ] Unsupported: YAML input and output.
- [ ] Unsupported: TOML input and output.
- [ ] Unsupported: preservation of comments, whitespace, source ordering, or
  other format trivia.
- [ ] Unsupported: opaque preservation of unknown Undulate fields.
- [ ] Round-trip risk: unknown fields on ordinary digital signals and unknown
  top-level fields are not comprehensively rejected and may be dropped.

Upstream references:
[supported syntax](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/supported_syntax.rst),
[JSONML parser](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/src/undulate/parsers/jsonml.py),
[YAML parser](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/src/undulate/parsers/yaml.py),
[TOML parser](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/src/undulate/parsers/toml.py).

## 2. Shared digital waveform features

### Supported

- [x] Logic states `0`, `1`, unknown `x`/`X`, high-impedance `z`/`Z`, pull-up
  `u`/`U`, and pull-down `d`/`D`.
- [x] Continuation with `.`.
- [x] Clock states `p`, `P`, `n`, and `N`.
- [x] Bus states `x`, `X`, `=`, and color indices `2` through `9`.
- [x] Bus data labels supplied as strings or arrays.
- [x] Lane gaps with `|`.
- [x] Explicit repeated transitions represented by the app as glitches.
- [x] Blank spacer rows.
- [x] Nested groups in the shared WaveDrom JSON array form.
- [x] Scalar `phase`.
- [x] Scalar `period` round-trip for ordinary bit and vector lanes.
- [x] WaveDrom-compatible single-character node strings.
- [x] WaveDrom-compatible `edge` dependency strings and labels.
- [x] Supported WaveDrom sub-cycle marker syntax on scalar bit lanes.
- [x] Diagram `hscale`, supported skins, headers, footers, ticks, and tocks.

### Partial or unsupported

- [ ] Partial: Undulate uses additional digital symbols such as `h`, `H`, `l`,
  and `L`; these are not ordinary editable digital states in the app.
- [ ] Unsupported: metastability states `m` and `M`.
- [ ] Unsupported: impulse states `i` and `I`.
- [ ] Unsupported: Undulate long node identifiers.
- [ ] Unsupported: Undulate-only edge markers `#` and `*` and the complete
  extended path set as structured annotations.
- [ ] Unsupported: the Undulate `edges` plural field. The shared WaveDrom
  `edge` field is supported.
- [ ] Round-trip risk: a digital `edges` field may be accepted as an unknown
  top-level property and then omitted.

Upstream references:
[digital symbols](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_dig_step1.rst),
[clocks](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_dig_step2.rst),
[buses](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_dig_step3.rst),
[groups](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_dig_step4.rst).

## 3. Extended digital timing

### Supported or partial

- [x] Scalar `phase` is preserved.
- [x] Scalar `period` is preserved on ordinary digital lanes.
- [ ] Partial: `repeat` is expanded for analogue signals during import, but is
  not retained as a first-class property or re-emitted.
- [ ] Partial: transition slewing exists for analogue `s` cells, not for
  ordinary digital or clock lanes.

### Unsupported and round-trip risks

- [ ] Unsupported: digital `repeat`.
- [ ] Unsupported: per-cell `periods`.
- [ ] Unsupported: `duty_cycle` and `duty_cycles`.
- [ ] Unsupported: digital/clock `slewing`.
- [ ] Unsupported: a general fine-timing timebase or app-native Sub-Steps
  control.
- [ ] Round-trip risk: digital `repeat`, `periods`, `duty_cycle`,
  `duty_cycles`, and `slewing` are not comprehensively rejected and may be
  silently dropped.

Upstream reference:
[period, duty cycle, phase, and repeat](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_dig_step5.rst).

## 4. Annotations

### Supported

- [x] Plain text annotations with finite numeric `x` and `y`.
- [x] Vertical line annotations with `shape: "|"` and finite numeric `x`.
- [x] Horizontal line annotations with `shape: "-"` and finite numeric `y`.
- [x] Creation through dedicated Text, V line, and H line tools.
- [x] Selection, property editing, deletion, undo, and redo.
- [x] Rendering in the live canvas, local render, SVG, PNG, and JPEG.
- [x] Text is escaped in generated SVG.
- [x] Supported annotations within the app's bounds round-trip through
  Undulate JSON.

### Partial

- [ ] Partial: imported `x` positions snap to the app's integer step grid.
- [ ] Partial: `y` is converted to a signal-relative or diagram-relative
  logical offset and normalized to integer pixels.
- [ ] Partial: annotations are limited to 1000 objects and text is limited to
  2000 characters.
- [ ] Partial: line annotations always span the app's full relevant canvas;
  Undulate `from` and `to` range limits are not supported.
- [ ] Partial: plain annotations use the app's fixed presentation rather than
  Undulate renderer styling.

### Unsupported

- [ ] Unsupported: global time compression with `shape: "||"`.
- [ ] Unsupported: arrows and other shape annotations using `from`, `to`, and
  extended connector patterns.
- [ ] Unsupported: `dx` and `dy`.
- [ ] Unsupported: `fill`, `stroke`, `stroke-width`, and
  `stroke-dasharray`.
- [ ] Unsupported: `font-size` and other text styles.
- [ ] Unsupported: `text_background`.
- [ ] Unsupported: unknown annotation shapes or fields. These are explicitly
  rejected and are not preserved opaquely.
- [ ] Round-trip risk: over-limit annotation counts, text, coordinates, or
  offsets are currently normalized or truncated rather than rejected before
  import.

Upstream references:
[annotation tutorial](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_ann_step2.rst),
[WaveDrom-compatible edges](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_ann_step1.rst).

## 5. Analogue waveforms

### Supported

- [x] Analogue lanes as a distinct editable signal type.
- [x] Numeric step cells using Undulate `s`.
- [x] Numeric capacitive cells using Undulate `c`.
- [x] Explicit sampled arbitrary cells using Undulate `a` with finite
  `[time, value]` pairs.
- [x] Hold cells represented by the initial `0`/`1` level and `.`.
- [x] Bounded finite sample data, with at most 4096 points per cell.
- [x] Bounded analogue voltage range in the app inspector.
- [x] Numeric `slewing` for step geometry.
- [x] Bounded `vscale` from 0.25 through 16.
- [x] Consecutive analogue overlay chains.
- [x] Overlay label `order` values 0 through 4.
- [x] Analogue creation, cell selection, transition/value editing, and
  undo/redo.
- [x] Shared analogue geometry in the live canvas, local render, SVG, PNG,
  and JPEG.
- [x] Explicit validation errors for non-finite values, malformed samples,
  value-count mismatches, and unsupported analogue fields.

### Partial

- [ ] Partial: analogue `repeat` is expanded on import rather than preserved
  and emitted as `repeat`.
- [ ] Partial: sampled `a` cell times are normalized into the inclusive 0..1
  cell range; the original absolute time coordinates are not retained.
- [ ] Partial: imported voltage context defaults to 0..1.8 because upstream
  `VDDA`/`VSSA` context is not represented in the source bridge.
- [ ] Partial: analogue values are clamped to the app's finite
  ±1,000,000,000 range; negative slew becomes zero and `vscale` is clamped to
  0.25..16.
- [ ] Partial: overlays are inferred from consecutive analogue lanes; there is
  no explicit overlay-group object or polished ambiguous-curve picker.
- [ ] Partial: the upstream four-wave overlay limit is not enforced as an
  interoperability constraint.
- [ ] Partial: sample points can be edited through Undulate JSON, but the
  inspector exposes only the cell kind and settled value; there is no
  dedicated point or curve editor.

### Unsupported

- [ ] Unsupported: Python-like scalar expressions such as `"0.5*VDDA"`.
- [ ] Unsupported: Python-like arbitrary curve expressions and list
  comprehensions.
- [ ] Unsupported: expression preservation as opaque source.
- [ ] Unsupported: per-signal `stroke`, `fill`, `stroke-width`,
  `stroke-dasharray`, and `font-size`.
- [ ] Unsupported: mixed metastability/impulse symbols inside analogue wave
  strings as true Undulate states. Do not rely on `m`, `M`, `i`, or `I`.
- [ ] Out of scope: evaluating imported Python or reproducing Undulate's
  expression runtime.

Upstream references:
[analogue cells](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_ana_step1.rst),
[overlays and style overloading](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_ana_step2.rst).

## 6. Styling

### Supported

- [x] App-native themes, accent color, canvas color, and existing WaveDrom bus
  palette choices affect browser rendering.
- [x] Generated SVG text is escaped and output is sanitized.

### Unsupported

- [ ] Unsupported: Undulate per-object CSS-style fields on signals,
  annotations, and edges.
- [ ] Unsupported: imported `stroke`, `fill`, `stroke-width`,
  `stroke-dasharray`, `font-size`, and `text_background`.
- [ ] Unsupported: global Undulate CSS files and renderer style overloading.
- [ ] Unsupported: lossless translation between app-native visual settings
  and Undulate style fields.

## 7. Rendering and exports

### Supported

- [x] Interactive browser canvas rendering.
- [x] Browser-local preview of the current Undulate JSON subset.
- [x] SVG export from the app renderer.
- [x] PNG export at 1x, 2x, and 3x.
- [x] JPEG export at 1x, 2x, and 3x.
- [x] Copy as PNG and copy as SVG where browser clipboard support is
  available.
- [x] WaveDrom compatible-subset export with explicit findings for supported
  extension objects that cannot be represented.
- [x] Undulate JSON compatibility findings for converted annotations and
  analogue lanes.

### Unsupported

- [ ] Unsupported: PDF export.
- [ ] Unsupported: PostScript or EPS export.
- [ ] Unsupported: terminal rendering.
- [ ] Unsupported: invoking Undulate's Python/Cairo renderer locally.
- [ ] Out of scope: pixel-identical output with Undulate's SVG or Cairo
  renderers.

Upstream reference:
[Undulate README output formats](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/README.md).

## 8. Mode and feature-loss behavior

### Supported

- [x] Document-level Undulate extensions toggle.
- [x] A distinct final `UNDULATE` group in the vertical edit rail.
- [x] Extension creation and editing controls are hidden while disabled.
- [x] Existing extension objects are hidden and locked without changing their
  JSON when **Hide features and preserve JSON** is chosen.
- [x] **Cancel** leaves the mode and document unchanged.
- [x] **Remove Undulate features** deletes supported annotations and analogue
  lanes as one undoable edit.
- [x] Enabling and disabling the mode participates in document history.
- [x] WaveDrom export reports supported annotations and analogue lanes as
  incompatible rather than silently claiming lossless output.

### Partial

- [ ] Partial: the feature-loss summary counts supported annotations and
  analogue lanes only. It cannot count unknown fields because opaque data is
  not preserved.
- [ ] Partial: the compatibility report covers typed extension objects, not
  every documented Undulate property.

## 9. Intentionally out of scope

- [ ] Undulate register diagrams.
- [ ] Executing Python-like analogue expressions.
- [ ] Embedding Python, Pyodide, Cairo, or a server renderer.
- [ ] Byte-for-byte source round-trip.
- [ ] Pixel-identical reproduction of every Undulate renderer.

## 10. Highest-priority gaps

- [ ] **P0 — Close silent-loss paths.** Reject or preserve unknown top-level
  and digital-signal fields, especially `edges`, `repeat`, `periods`,
  `duty_cycle`, `duty_cycles`, `slewing`, and style properties.
- [ ] **P0 — Add upstream round-trip fixtures.** Import and re-export pinned
  examples for every feature marked supported.
- [ ] **P1 — Extended digital timing and states.** Add `repeat`, variable
  periods, duty cycles, digital slew, `m`/`M`, and `i`/`I`.
- [ ] **P1 — Complete annotation geometry.** Add `from`/`to`, global
  compression, structured arrows, and fractional coordinates.
- [ ] **P2 — Safe normalized styling.** Add a strict allowlist for colors,
  widths, dashes, font sizes, and text backgrounds.
- [ ] **P2 — Opaque preservation.** Retain safe unknown declarative data and
  report when an edit invalidates it.
- [ ] **P3 — Additional formats and outputs.** Add safe YAML/TOML adapters and
  evaluate PDF only after the semantic model is stable.

## 11. Audit evidence in this repository

Primary implementation:

- `src/undulateBridge/undulateJSON.ts`
- `src/undulateBridge/types.ts`
- `src/shared/types.ts`
- `src/shared/analogue.ts`
- `src/shared/annotations.ts`
- `src/shared/compatibility.ts`
- `src/renderer/analogueGeometry.ts`
- `src/renderer/annotationLayout.ts`

Primary automated coverage:

- `src/undulateBridge/undulateJSON.test.ts`
- `src/codePanel/codeSync.test.ts`
- `src/shell/FileOperations.test.ts`
- `src/shared/store.test.ts`
- `src/shared/store/annotationActions.test.ts`
- `src/shared/compatibility.test.ts`
- `src/exportEngine/analogueExport.test.ts`
- `src/exportEngine/annotationExport.test.ts`
- `tests/e2e/release.spec.ts`
