# Undulate Support Plan

Status: design and implementation plan

Audience: maintainers and future contributors

Last updated: 2026-07-22

Target application: `waves-gui`

## Implementation progress

- [x] Validate supported WaveDrom sub-cycle marker structure.
- [x] Add version 2 migration foundations and document compatibility metadata.
- [x] Add an undoable document-level Undulate extensions toggle.
- [x] Add the typed annotation model and first free-text annotation.
- [x] Add Undulate JSON import/export and compatibility reporting.

### Current implemented slice

The first vertical slice is complete on `rek-undulate`:

- the target Undulate behavior is pinned to revision
  `c8da7d48c48fc0bbc90113b6913611132bd96c01`;
- version 2 documents store typed text annotations with a tick, an optional
  semantic signal anchor, and a logical Y offset;
- the Text tool creates annotations, and selection/property controls edit or
  delete them with undo/redo support;
- annotations render in the live canvas and PNG, JPEG, and safely escaped SVG
  exports;
- turning extensions off hides and locks annotations without deleting them;
- autosave, raw WaveDrom code edits, file open, and file save preserve supported
  annotation content;
- Undulate JSON maps text annotations to upstream `text`, `x`, and `y` fields;
- WaveDrom export reports annotations as unsupported and labels the action as
  exporting a compatible subset.

The current Undulate annotation bridge intentionally supports plain text
annotations only. Shapes, styling fields such as `fill`, vertical/horizontal
lines, and other unknown annotation properties are rejected explicitly rather
than silently discarded. Opaque preservation of unsupported Undulate fields,
YAML/TOML, fine timing, extended styling, and analogue features remain future
phases.

## 1. Purpose

This document preserves the product and engineering decisions for adding optional
[Undulate](https://github.com/LudwigCRON/undulate) compatibility to `waves-gui`.
It is intended to remain useful after the original design conversation is no
longer available.

The goal is not to replace the current WaveDrom workflow or redesign the
interface. The goal is to add an optional **Undulate extensions** mode that
unlocks richer annotations, timing controls, styling, mixed-signal waveforms,
and Undulate-compatible interchange while leaving the existing interface and
default behavior essentially unchanged.

The central product idea is:

> One editor, one internal document model, and multiple compatibility targets.

WaveDrom remains the default compatibility target. Undulate becomes an additive
expert layer.

## 2. Background

### 2.1 Current application architecture

The current application has a useful separation of concerns:

```text
File / JSON editor <-> wavedromBridge <-> DiagramState <-> Zustand store
                                                |
                                                v
                                         CanvasRenderer
```

Important properties of the current design:

- The application is client-only.
- WaveDrom parsing and emission are isolated in `src/wavedromBridge/`.
- The renderer consumes an internal `DiagramState`, not raw WaveJSON.
- The existing model already supports bit lanes, vector lanes, spacers, nested
  groups, clocks, gaps, glitches, phase, period, nodes, edges, headers, footers,
  custom colors, and WaveDrom subcycle wave syntax.
- File loading accepts strict JSON, detects WaveDrom versus Undulate annotation
  roots, and validates the currently supported subset before import.
- Image rendering and export are already implemented independently of the
  upstream WaveDrom renderer.

This makes an additional format bridge realistic. The difficult part is not
parsing YAML, TOML, or extended JSON. The difficult part is defining and
rendering a richer, stable internal model.

### 2.2 What Undulate adds

Undulate intentionally extends the WaveDrom/WaveJSON model. Features observed
in its documentation and source include:

- long node identifiers;
- additional edge markers and paths;
- standalone annotations;
- global time-compression annotations;
- vertical and horizontal annotation lines;
- text annotations at arbitrary positions;
- per-object style overrides;
- metastability symbols;
- impulse states;
- transition slewing;
- duty-cycle controls;
- per-cell period controls;
- waveform repetition;
- analogue step, capacitive, slew, and arbitrary curves;
- overlays of multiple signals;
- per-lane vertical scaling;
- JSON/JSON-like, YAML, and TOML inputs;
- SVG, PNG, PDF, and PostScript output through Python/Cairo renderers.

The Undulate repository inspected during planning reported project version
`2024.1`. Its latest inspected `master` commit was `c8da7d4` dated 2024-09-19.
Compatibility work must use fixtures pinned to a known revision rather than
assuming the upstream format will never change.

### 2.3 WavePaint ideas considered

[WavePaint](https://www.wavepaint.net/app/) was reviewed as a source of useful
interaction ideas. Two features are especially relevant:

- **Text Annotation**: conceptually and structurally compatible with Undulate's
  annotation system.
- **Sub-Steps**: useful as an app-native fine-timing feature, but not an
  Undulate property with the same name. It can be translated to Undulate using
  expanded cells and fractional `period` values.

WavePaint's application model uses properties such as `textAnnotations`, a
global `subStepCount`, and per-signal `subSteps`. Those names are WavePaint
details and must not become accidental interchange standards in this project.

## 3. Goals

### 3.1 Product goals

1. Preserve the current interface and WaveDrom-first workflow by default.
2. Add one clear document-level toggle for Undulate extensions.
3. Reveal extended controls contextually only while the toggle is enabled.
4. Import, edit, render, and export a useful subset of Undulate diagrams.
5. Preserve unsupported Undulate properties during lossless round trips where
   safely possible.
6. Warn before any export or operation that would lose information.
7. Keep all diagram processing local to the browser.
8. Avoid executing code embedded in imported diagram files.
9. Introduce features incrementally without destabilizing WaveDrom behavior.

### 3.2 Engineering goals

1. Evolve `DiagramState` into a format-neutral superset model.
2. Keep WaveDrom and Undulate conversion in dedicated adapters.
3. Keep the renderer independent of both file formats.
4. Represent fine timing without floating-point drift.
5. Make feature support inspectable through a capability report.
6. Maintain deterministic exports and golden fixtures.
7. Preserve undo/redo, autosave, dirty-state detection, and security guarantees.

## 4. Non-goals

The initial work will not:

- replace the existing WaveDrom mode;
- reproduce the complete Undulate Python implementation;
- embed Python, Pyodide, Cairo, or a server-side renderer;
- execute imported Python analogue expressions;
- promise pixel-identical output with every Undulate renderer;
- support Undulate register diagrams in the first implementation;
- make PDF or PostScript a first-class browser export merely because Undulate
  supports them;
- make YAML or TOML the canonical internal representation;
- redesign the primary toolbar or general application layout;
- silently delete, flatten, or approximate unsupported features.

## 5. Terminology

### 5.1 WaveDrom mode

The default application mode. Only features that can be represented by the
project's supported WaveDrom/WaveJSON subset may be created through the GUI.

### 5.2 Undulate extensions mode

An optional document capability mode. It exposes supported Undulate features
and app-native features with reliable Undulate translations.

### 5.3 Native Undulate feature

A feature that has a direct representation in Undulate input, such as an
`annotations` entry or a signal `slewing` property.

### 5.4 Translatable extension

A feature with no identical Undulate property but with a deterministic mapping
to Undulate semantics. Sub-Steps are the primary example.

### 5.5 Preserved opaque data

Imported data the app does not understand but retains so that saving back to
the same target does not destroy it. Opaque data is never executed.

### 5.6 Compatibility report

A structured list of features that are supported, converted, approximated,
preserved opaquely, or omitted for a selected export target.

## 6. Core product decisions

### 6.1 The toggle is document-level

The proposed control is conceptually:

```text
WaveDrom mode  ○────●  Undulate extensions
```

It is not merely a display preference because enabling it changes which
features can exist in the diagram.

For a new document:

- the default is WaveDrom mode;
- enabling the toggle does not modify existing lanes;
- the mode becomes dirty document state only if it must be persisted by the
  app's native save format;
- exporting plain WaveDrom without extensions should remain clean and simple.

For an imported document:

- a WaveDrom document opens in WaveDrom mode;
- an Undulate document containing supported extensions opens with extensions
  enabled;
- a document containing only the shared subset may remain in WaveDrom mode;
- opaque Undulate properties cause an extension-content indicator even if no
  native extended object can yet be rendered.

### 6.2 Turning extensions off is non-destructive

Turning off the toggle must never silently remove data.

If no extensions exist, the toggle simply returns the UI to WaveDrom mode.

If extensions exist, the application should explain what will happen:

```text
This diagram contains Undulate extensions:

• 1 analogue signal
• 2 text annotations
• custom styling on 3 signals

The extensions will remain in the document but will be hidden and locked while
WaveDrom mode is active.
```

The initial action should be **Hide extensions**, not remove them. A separate,
explicit command may later offer conversion or deletion with an exact preview.

When hidden extension content exists, show a small persistent status affordance:

```text
Undulate extensions hidden · 6 objects
```

### 6.3 Mode and export format are separate concepts

An Undulate-mode document may still be exported to WaveDrom if it only uses the
shared subset. Conversely, the user may choose Undulate JSON for a simple
digital diagram.

The document mode controls creation and editing capabilities. The export target
controls serialization and compatibility warnings.

### 6.4 App-native features must not be mislabeled

Sub-Steps should appear while extensions are enabled, but documentation should
describe them as **fine timing exportable to Undulate**, not as a verbatim
Undulate property.

## 7. Proposed user experience

### 7.1 Interface preservation

The current interface remains the baseline. Enabling extensions augments
existing controls rather than replacing them.

| Existing area | Additional controls while enabled |
| --- | --- |
| Add signal | Analogue signal and extended digital presets |
| State selector | Metastable, impulse, analogue step/capacitive/slew states |
| Signal context menu | Overlay, repeat, slew, vertical scale, style |
| Edge tools | Long node names and additional markers |
| Toolbar | Annotation tool or an Extensions popover |
| Properties | Contextual annotation/signal style fields |
| Code panel | Undulate fields and eventually YAML/TOML language modes |
| Export dialog | Undulate JSON/YAML/TOML and compatibility report |

The primary toolbar should not display every extended property at once.
Uncommon controls belong in the existing context menus, a contextual properties
surface, or a compact Extensions popover.

### 7.2 Extended object editing

The Select Object tool should select annotations, overlay members, markers, and
other extended objects. Selected objects expose their properties using the same
interaction language as existing edges and signals.

### 7.3 Compatibility feedback

Compatibility feedback should be available before export, not only after a
failed operation.

Example:

```text
WaveDrom export

✓ 8 digital signals
✓ 3 dependency edges
△ 4 sub-steps per step will use subcycle/expanded timing
✕ 1 analogue signal cannot be represented
✕ 2 free text annotations cannot be represented
△ Custom signal styles will be removed
```

Actions:

- Export compatible subset
- Export as Undulate instead
- Cancel

No lossy export should also overwrite the clean/saved baseline without making
the loss explicit.

## 8. Compatibility matrix

This table is a planning baseline, not a permanent promise. Each row needs a
fixture and an automated support classification before release.

| Feature | Current app | WaveDrom export | Undulate export | Initial strategy |
| --- | --- | --- | --- | --- |
| Bit lanes | Yes | Native | Native | Preserve |
| Vector lanes/data | Yes | Native | Native | Preserve |
| Nested groups | Yes | Native | Native/shared JSON structure | Verify fixtures |
| Spacers | Yes | Native | Supported | Preserve |
| Phase | Yes | Native | Supported | Preserve |
| Period | Yes | Native | Supported | Preserve |
| Gaps | Yes | Native | Supported | Preserve |
| Glitches/repeated transitions | Yes | Native subset | Supported subset | Verify rendering |
| Clock states | Yes | Native | Supported | Preserve |
| Subcycle wave syntax | Yes | Native supported subset | Convert/verify | Keep bridge-specific |
| Dependency edges | Yes | Native `edge` | `edge`/`edges` adapter | Normalize internally |
| Edge labels | Yes | Native subset | Supported | Preserve |
| Long node names | No | Allocate temporary node chars | Native Undulate concept | Add semantic anchors |
| Free text annotations | Yes (plain text) | Unsupported with explicit report | Native `text`/`x`/`y` conversion | Implemented first slice |
| Vertical/horizontal annotations | No | Unsupported | Native annotations | Add annotation model |
| Global time compression | Lane gaps only | Approximate/unsupported | Native `||` annotation | Add diagram annotation |
| Per-object styling | Partial internal colors | Mostly unsupported | Native style overrides | Add normalized style |
| Slewing | No | Unsupported | Native | Add signal timing style |
| Duty cycle | Fixed clock behavior | Limited | Native | Add scalar/series values |
| Per-cell periods | No | Limited/expanded | Native `periods` | Add tick durations |
| Repeat | Encoded by wave length | Expanded | Native `repeat` | Canonicalize internally |
| Metastability | No | Unsupported | Native `m`/`M` | Add extended state |
| Impulse | No | Unsupported | Native `i`/`I` | Add extended state |
| Analogue step | No | Unsupported | Native `s` | Add analogue lane |
| Capacitive transition | No | Unsupported | Native `c` | Add analogue lane |
| Arbitrary analogue curve | No | Unsupported | Native `a` | Samples first; expressions opaque |
| Signal overlays | No | Unsupported | Native `overlay` | Add overlay groups/layout |
| Vertical lane scale | Row height only | Unsupported | Native `vscale` | Map deliberately |
| Sub-Steps | Partial subcycle foundations | Convert if possible | Expand with fractional period | App-native timebase |
| YAML input/output | No | N/A | Native Undulate format | Later adapter |
| TOML input/output | No | N/A | Native Undulate format | Later adapter |
| JSON-like comments | Code panel uses JSON5 in places | Nonstandard | Undulate accepts JSON-like input | Decide separately |
| Register diagrams | No | WaveDrom has separate register form | Undulate supports register context | Out of initial scope |

## 9. Internal model evolution

### 9.1 General direction

Do not store a raw Undulate document as the editor's source of truth. Evolve the
internal model into a format-neutral superset and add adapters:

```text
WaveDrom JSON  <-> wavedromBridge --+
                                      |
Undulate JSON  <-> undulateBridge ----+-> DiagramState -> renderer/tools
Undulate YAML  <-> undulateBridge ----+
Undulate TOML  <-> undulateBridge ----+
```

The model should express user intent, not a particular serializer's spelling.

### 9.2 Versioning

The current `DiagramState.version` is `1`. Extended documents should move to a
new explicit native schema version, tentatively version `2`.

Migration rules:

- version 1 loads with `extensionsEnabled: false`;
- existing signal arrays migrate without semantic changes;
- existing string edges migrate to structured edges lazily or through a tested
  parser;
- IDs remain stable during an in-memory migration;
- migration must be deterministic and idempotent;
- loading a legacy document must not mark it dirty until the user changes it,
  unless the application deliberately adopts migration-on-save behavior.

### 9.3 Tentative top-level model

The exact TypeScript may change, but the responsibilities should remain clear:

```ts
interface DiagramStateV2 {
  version: 2;
  compatibility: {
    extensionsEnabled: boolean;
    sourceFormat?: 'wavedrom-json' | 'undulate-json' | 'undulate-yaml' | 'undulate-toml';
    sourceRevision?: string;
  };
  timebase: Timebase;
  signals: SignalOrGroup[];
  edges: DiagramEdge[];
  annotations: DiagramAnnotation[];
  config: DiagramConfig;
  opaqueSource?: OpaqueSourceData;
}
```

`extensionsEnabled` controls the document editing mode. It does not determine
whether extensions are present; that is derived by scanning the document.

### 9.4 Unknown property preservation

Known extended properties should be normalized into typed fields. Unknown
properties may be retained in namespaced source bags:

```ts
interface SourceExtras {
  undulate?: Record<string, JsonCompatibleValue>;
}
```

Rules:

1. Unknown values must be JSON-compatible after parsing.
2. Prototype-bearing objects must be normalized to plain data.
3. Functions, executable objects, and parser-specific instances are rejected.
4. Known properties must not also remain in `SourceExtras`.
5. If native editing invalidates an opaque field, warn and remove only that
   field rather than silently emitting stale contradictory data.
6. Cross-format export may not be able to preserve format-specific trivia such
   as comments, whitespace, key ordering, or TOML structure.

Lossless **semantic** round-trip is the target. Byte-for-byte round-trip is not.

## 10. Time model and Sub-Steps

### 10.1 Problem

The current model largely uses integer steps, with special handling for
WaveDrom phase, period, and subcycle strings. Extended timing needs:

- transitions inside a major step;
- different fine resolutions between lanes;
- annotations at fractional times;
- variable cell durations;
- stable snapping and hit-testing;
- deterministic serialization without floating-point accumulation errors.

### 10.2 Use integer ticks internally

Represent positions using integer ticks relative to a document timebase:

```ts
interface Timebase {
  majorSteps: number;
  ticksPerStep: number; // 1 for ordinary diagrams
}

type Tick = number; // constrained to non-negative safe integers
```

For four sub-steps per major step:

```text
major step 0 -> tick 0
sub-step 1  -> tick 1
sub-step 2  -> tick 2
sub-step 3  -> tick 3
major step 1 -> tick 4
```

This makes snapping, annotation placement, ranges, and layout exact.

### 10.3 Resolution changes

Changing `ticksPerStep` must preserve absolute logical time:

- increasing from 2 to 4 multiplies stored ticks by 2;
- decreasing is allowed only when every stored position is divisible by the
  reduction factor, or after the user chooses a rounding policy;
- rounding must preview affected transitions and annotations;
- the common denominator of imported fractional positions may determine the
  initial timebase, subject to a safety limit.

Set a maximum supported resolution to prevent malicious files or accidental UI
values from allocating enormous arrays. The exact limit should follow renderer
profiling; a provisional limit such as 64 or 256 ticks per step is reasonable.

### 10.4 Per-signal resolution

The simplest model uses one document timebase. A signal may expose a UI
`subSteps` value, but its stored transitions still use document ticks.

If per-signal subdivisions are required, calculate a common document timebase
using the least common multiple, with a strict cap. Do not maintain unrelated
floating grids per lane unless profiling proves the common-grid approach
unworkable.

### 10.5 Undulate conversion

For `N` uniform sub-steps per major step:

```text
Undulate period = 1 / N
```

The exporter expands the lane into microcells so that `N` cells occupy one
major-step width. Example conceptually:

```yaml
fast_signal:
  wave: "01.0....1......."
  period: 0.25
```

This conversion requires golden rendering tests because fractional periods may
interact with phase, repeat, gaps, clock symbols, and output width.

### 10.6 WaveDrom conversion

WaveDrom export should choose the least lossy supported representation:

1. existing supported subcycle syntax when it represents the lane exactly;
2. expanded cells with adjusted period/phase when upstream WaveDrom accepts it;
3. an explicit incompatibility result;
4. approximation only after user confirmation.

The exporter must never claim exact compatibility merely because an SVG looks
approximately aligned.

## 11. Annotation model

### 11.1 Requirements

Annotations need stable semantic anchors. Raw canvas pixels are unsuitable
because row heights, label widths, zoom, themes, and exports can change.

Tentative model:

```ts
type AnnotationAnchor =
  | { kind: 'diagram'; tick: Tick; rowPosition: number }
  | { kind: 'signal'; signalId: string; tick: Tick; vertical: 'top' | 'center' | 'bottom' }
  | { kind: 'edge'; edgeId: string; position: number }
  | { kind: 'node'; nodeId: string }
  | { kind: 'absolute'; x: number; y: number; coordinateSpace: 'logical-canvas' };

interface TextAnnotation {
  id: string;
  type: 'text';
  text: string;
  anchor: AnnotationAnchor;
  offsetX: number;
  offsetY: number;
  style?: AnnotationStyle;
  sourceExtras?: SourceExtras;
}

interface LineAnnotation {
  id: string;
  type: 'vertical-line' | 'horizontal-line' | 'global-compression';
  position: AnnotationAnchor;
  style?: AnnotationStyle;
  sourceExtras?: SourceExtras;
}

interface ShapeAnnotation {
  id: string;
  type: 'shape';
  shape: string;
  from?: AnnotationAnchor;
  to?: AnnotationAnchor;
  text?: string;
  textBackground?: boolean;
  style?: AnnotationStyle;
  sourceExtras?: SourceExtras;
}

type DiagramAnnotation = TextAnnotation | LineAnnotation | ShapeAnnotation;
```

### 11.2 Undulate mapping

Undulate annotation examples use properties such as:

- `shape`;
- `x` and `y`;
- `from` and `to`;
- `text`;
- `dx` and `dy`;
- `fill` and `stroke`;
- `stroke-width`;
- `stroke-dasharray`;
- `text_background`.

The bridge translates these into semantic anchors and normalized styles.
Unknown shapes may be preserved opaquely and rendered as unsupported-object
placeholders rather than ignored.

### 11.3 WaveDrom mapping

- Edge labels map back to WaveDrom edge strings when representable.
- Header/footer text is not treated as a free annotation; it remains diagram
  configuration.
- Arbitrary text, lines, and shapes are unsupported in ordinary WaveDrom
  output and appear in the compatibility report.
- A future SVG-only export can always render native annotations because it uses
  the app's renderer; this does not make the WaveJSON itself compatible.

## 12. Nodes and edges

### 12.1 Move toward semantic node IDs

The existing WaveDrom bridge uses single-character node anchors. Internally,
extended documents should use stable node objects:

```ts
interface DiagramNode {
  id: string;
  name: string;
  signalId: string;
  tick: Tick;
  visibleLabel?: string;
}
```

Structured edges can then refer to node IDs rather than parsing strings during
every edit:

```ts
interface DiagramEdge {
  id: string;
  fromNodeId: string;
  toNodeId?: string;
  connector: string;
  label?: string;
  style?: AnnotationStyle;
  sourceExtras?: SourceExtras;
}
```

### 12.2 WaveDrom export

Allocate temporary legal WaveDrom node characters during serialization.
Allocation must be deterministic. If the number of simultaneous nodes exceeds
the supported character space, report incompatibility rather than reusing a
character ambiguously.

### 12.3 Undulate export

Use long node names where the target format permits them. Verify the precise
syntax for long names and the `#` expansion mechanism against pinned upstream
fixtures before implementing.

## 13. Signal extensions

### 13.1 Extended digital properties

Tentative normalized fields:

```ts
interface ExtendedTiming {
  repeat?: number;
  slew?: number;
  dutyCycle?: number;
  dutyCycles?: number[];
  periods?: number[];
}

interface OverlayPlacement {
  groupId: string;
  order?: 0 | 1 | 2 | 3 | 4;
}
```

Do not copy Undulate's pluralization quirks into unrelated parts of the model.
The bridge owns mappings such as `dutyCycle` to `duty_cycle` or `duty_cycles`.

### 13.2 Extended states

Do not add every Undulate wave character to the ordinary `BitState` union
without first deciding its rendering and editing semantics.

Possible direction:

```ts
type DigitalState =
  | ExistingBitState
  | 'metastable-to-zero'
  | 'metastable-to-one'
  | 'impulse-low'
  | 'impulse-high';
```

The bridge maps semantic states to target characters. This avoids letting a
single character become the domain model.

### 13.3 Analogue lanes

Analogue signals should become a distinct signal type rather than overloading
bit or vector lanes:

```ts
interface AnalogueSignal extends BaseSignal {
  type: 'analogue';
  segments: AnalogueSegment[];
  verticalRange: {
    min: number;
    max: number;
    unit?: string;
  };
  overlay?: OverlayPlacement;
}

type AnalogueSegment =
  | { id: string; kind: 'hold'; startTick: Tick; endTick: Tick; value: number }
  | { id: string; kind: 'step'; startTick: Tick; endTick: Tick; target: number; slew?: number }
  | { id: string; kind: 'capacitive'; startTick: Tick; endTick: Tick; target: number; coefficient?: number }
  | { id: string; kind: 'samples'; startTick: Tick; endTick: Tick; points: AnaloguePoint[] }
  | { id: string; kind: 'opaque-expression'; startTick: Tick; endTick: Tick; source: string };
```

Sample points should use normalized time within the segment or explicit ticks,
and a finite numeric value. Reject `NaN`, infinities, huge arrays, and invalid
ranges during import.

### 13.4 Expressions

Undulate accepts Python-like expressions for analogue curves and timing lists.
Its implementation parses an expression into a Python AST and eventually uses
`eval`. This project must not reproduce that execution path.

Initial policy:

- explicit numeric values are supported;
- explicit sampled point arrays are supported;
- recognized safe presets are supported;
- expression strings are preserved as opaque text;
- opaque expressions are never executed;
- the UI clearly states when a curve cannot be rendered;
- exporting back to Undulate may restore the original expression if it was not
  invalidated by editing.

A future expression language must use a small parser and strict allowlist. It
must not use JavaScript `eval`, `Function`, Python, WebAssembly-hosted Python,
or dynamic property access.

## 14. Styling

### 14.1 Normalized style model

Use typed, validated style fields:

```ts
interface AnnotationStyle {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  strokeDasharray?: number[];
  fontSize?: string;
  fontFamily?: string;
  opacity?: number;
}
```

Additional style properties may be added as needed. Do not accept arbitrary CSS
and insert it into the page or exported SVG.

### 14.2 Security and sanitization

- Parse colors into a supported safe subset.
- Reject CSS URLs, `var()` references from imported files, filters, scripts,
  event handlers, and unsupported functions.
- Clamp stroke widths, font sizes, opacity, and dash arrays.
- Escape all text in canvas-independent SVG exports.
- Continue passing generated SVG through the existing sanitizer.
- Treat custom font families as presentation hints, not remote resources.

### 14.3 WaveDrom degradation

Some current app colors already exceed canonical WaveDrom semantics. The
compatibility report should distinguish:

- semantic data preserved;
- color translated to the WaveDrom palette;
- styling omitted;
- image export exact even though WaveJSON export is lossy.

## 15. Overlay layout

Overlays are a major renderer and row-layout change.

### 15.1 Model

Several consecutive signals may share one visual row while remaining distinct
objects in the signal tree. Use an explicit overlay group ID rather than
inferring all behavior from adjacency.

### 15.2 Layout responsibilities

The row-layout layer must determine:

- shared row bounds;
- maximum vertical scale among overlay members;
- label positions and Undulate-compatible `order` hints;
- hit-test priority when curves overlap;
- selection cycling or a disambiguation menu;
- group and bracket behavior;
- annotation coordinates relative to the shared row;
- export dimensions.

### 15.3 Editing behavior

- Clicking a clearly separated curve selects that signal.
- Ambiguous clicks should cycle candidates or open a compact chooser.
- Hiding one overlay member must not collapse the row if others remain.
- Moving a signal into or out of an overlay group is undoable.
- Reordering signals must preserve explicit overlay membership or ask before
  breaking it.

## 16. Format adapters

### 16.1 WaveDrom bridge

The existing bridge remains authoritative for WaveDrom parsing and emission.
It should not acquire Undulate-specific branches everywhere.

Changes expected:

- consume the version 2 semantic time model;
- serialize structured nodes/edges;
- produce compatibility findings for unsupported objects;
- map exact Sub-Step cases when possible;
- ignore hidden-mode state and inspect actual document content;
- preserve all current golden behavior.

### 16.2 Undulate bridge

Proposed folder:

```text
src/undulateBridge/
  index.ts
  types.ts
  validate.ts
  detect.ts
  fromUndulate.ts
  toUndulate.ts
  annotations.ts
  analogue.ts
  timing.ts
  styles.ts
  compatibility.ts
```

The bridge should initially target Undulate JSON because it is closest to the
existing WaveDrom object model and easiest to test.

### 16.3 JSON dialects

Undulate accepts a relaxed JSON/JSONML-like dialect with comments and unquoted
keys. The application must decide explicitly whether to:

- accept strict JSON only for `.json`;
- accept JSON5 for `.json5` or a clearly described relaxed mode;
- accept Undulate's exact preprocessing quirks.

Recommendation: use a maintained parser with a defined grammar, not a set of
regular expressions that attempts to reproduce Undulate's Python preprocessor.

### 16.4 YAML

YAML support should use a safe schema:

- no custom tags;
- no constructors;
- no executable values;
- alias/depth/size limits;
- plain data output only.

Undulate YAML commonly omits the WaveDrom `signal` wrapper and uses signal names
as mapping keys. The adapter must preserve order and handle duplicate names
deliberately.

### 16.5 TOML

TOML signal names and nested groups require careful order preservation. The
adapter should produce deterministic key ordering and arrays-of-tables for
annotations. Comments will not initially round-trip.

### 16.6 Native project file

The project should eventually distinguish its lossless native save format from
interchange exports. A native extension such as `.wp` is already accepted by
one file-picker path, but its intended contract is not currently documented.

Before extended content ships, decide whether:

1. `.json` remains the native project file and includes app metadata;
2. `.wp` becomes a documented lossless project format;
3. native save always uses the selected source format.

Recommendation: establish a lossless app-native format for editing state, while
keeping WaveDrom and Undulate formats explicit interchange targets. This avoids
forcing app-only metadata into either ecosystem.

## 17. Import detection

Detection order should be based on parsed structure and extension, not filename
alone.

Possible flow:

```text
Read bytes
  -> enforce size limit
  -> choose safe parser using extension/user selection
  -> normalize plain data
  -> detect native project / WaveDrom / Undulate
  -> validate
  -> convert to DiagramState
  -> generate import report
  -> load only after successful conversion
```

Do not partially replace the current diagram after a parsing or validation
failure.

Extension signals include:

- top-level `annotations`;
- Undulate-only signal properties;
- analogue wave characters;
- overlay properties;
- long-node syntax;
- Undulate YAML/TOML structural forms;
- preserved opaque Undulate fields.

## 18. Export and compatibility reporting

### 18.1 Finding model

```ts
type CompatibilityLevel =
  | 'exact'
  | 'converted'
  | 'approximated'
  | 'opaque'
  | 'unsupported';

interface CompatibilityFinding {
  level: CompatibilityLevel;
  feature: string;
  objectId?: string;
  message: string;
  consequence?: string;
}
```

### 18.2 Policy

- `exact`: no warning required beyond the summary.
- `converted`: show informational detail when meaningful.
- `approximated`: require confirmation.
- `opaque`: explain whether it will be retained for the selected target.
- `unsupported`: block lossless export and offer explicit subset export.

### 18.3 Source export versus image export

SVG/PNG/JPEG exported from the app renderer can include all natively rendered
extensions. Source-format compatibility is a separate question. The UI should
not describe an SVG as “WaveDrom compatible” merely because it depicts the same
diagram.

## 19. Renderer plan

### 19.1 Keep one renderer

Do not introduce a second Python-derived renderer. Extend the current rendering
pipeline through composable layers:

```text
Background and grid
  -> ordinary digital/vector lanes
  -> analogue and overlay lanes
  -> nodes and edges
  -> markers and Undulate annotations
  -> selection/tool overlays
  -> pointer marker and UI affordances
```

### 19.2 Coordinate system

All layers should use shared helpers for:

- tick-to-X conversion;
- X-to-nearest-tick conversion;
- signal/overlay row bounds;
- logical canvas versus device pixels;
- annotation anchors;
- export dimensions.

Avoid feature-specific coordinate arithmetic scattered through components.

### 19.3 Unsupported placeholders

When an object is preserved but not rendered, optionally show a non-exported UI
placeholder while extensions are enabled:

```text
Unsupported Undulate expression · preserved on save
```

The placeholder must not imply that the actual waveform is flat or zero.

### 19.4 Performance

Profile at minimum:

- 100 digital lanes with fine timing;
- several analogue lanes with thousands of points;
- four overlaid curves;
- hundreds of annotations;
- zoomed-out full-document rendering;
- image export at high scale.

Use downsampling for visual analogue curves while retaining full source data.

## 20. Tools and interactions

### 20.1 Annotation tool

One annotation tool may use a small type selector:

- Text
- Vertical line
- Horizontal line
- Global time compression
- Extended arrow/shape

Creation should use ticks and semantic row anchors. Dragging after creation
updates offsets or anchors deliberately rather than converting everything to
absolute pixels.

### 20.2 Fine-timing editing

The existing Steps control gains Sub-Steps only while extensions are enabled.

Potential presentation:

```text
Steps:      [ 20 ]
Sub-Steps:  [  4 ]
```

The grid should visually distinguish major and minor lines. Snapping uses minor
ticks, while keyboard navigation may offer both minor-step and major-step
movement.

### 20.3 Analogue editing

Start with constrained, visual operations:

- paint/hold a numeric level;
- create a step to a target value;
- select slew or capacitive transition;
- edit target value and duration;
- import explicit sample points;
- overlay selected analogue lanes.

An expression editor is not part of the first native analogue UI.

## 21. Validation and limits

Every parser and editor action must enforce finite limits.

Provisional categories:

- maximum file size;
- maximum number of signals/groups;
- maximum nesting depth;
- maximum steps and ticks;
- maximum annotations and edges;
- maximum text length;
- maximum sample points per analogue lane;
- maximum style-array length;
- maximum YAML alias expansion;
- maximum opaque-property depth and total size.

Limits should produce actionable errors, not browser hangs. Exact values should
be chosen from performance tests and documented centrally.

## 22. Testing strategy

### 22.1 Unit tests

- timebase conversions and resolution changes;
- semantic node allocation;
- annotation anchor conversions;
- style parsing and rejection;
- analogue sample validation;
- compatibility classification;
- each format parser and serializer;
- unknown-field preservation;
- migration from version 1 to version 2.

### 22.2 Round-trip tests

For every supported Undulate feature:

```text
fixture -> import -> DiagramState -> export -> re-import -> semantic comparison
```

IDs generated during import should be excluded from comparisons unless the
native project format promises stable IDs.

### 22.3 Golden rendering tests

Create pinned fixtures for:

- annotations;
- long node edges;
- slewing and duty cycles;
- metastability and impulses;
- Sub-Step alignment;
- analogue step/capacitive/sampled curves;
- overlays;
- mixed digital/analogue diagrams;
- extended styles.

Compare geometry and selected pixels/paths rather than relying only on complete
image snapshots that are fragile across platforms.

### 22.4 Upstream interoperability tests

Where the environment permits:

- run exported Undulate fixtures through a pinned Undulate CLI revision;
- verify successful SVG generation;
- inspect SVG dimensions and key elements;
- keep the external integration test optional locally but required in a
  dedicated compatibility workflow if reproducible dependencies are available.

Do not install from an unpinned `master` branch in CI.

### 22.5 Security tests

Add hostile fixtures containing:

- HTML and SVG markup in text;
- CSS URLs and event-handler-like strings;
- Python import/call expressions;
- huge nested YAML aliases;
- non-finite analogue values;
- enormous period/substep values;
- prototype-pollution keys;
- malformed annotation anchors;
- recursive or excessively deep groups;
- oversized opaque data.

Verify no network requests, script execution, DOM injection, or unbounded work.

### 22.6 Regression gate

Every phase must continue to pass the existing WaveDrom golden, security,
renderer, unit, build, and end-to-end release gates.

## 23. Delivery phases

The phases below are ordered to provide value early while postponing the most
structurally expensive work.

### Phase 0: Research fixtures and specification

Deliverables:

- pin the target Undulate revision/version;
- vendor or cite a small set of synthetic, license-compatible fixtures;
- document exact JSON mappings for the shared subset;
- prove current WaveDrom exports render through Undulate;
- define the native project-format decision;
- create the compatibility-finding types.

Definition of done:

- no UI changes;
- automated evidence for what already interoperates;
- ambiguous upstream behavior recorded as testable open questions.

Estimated effort: several days.

### Phase 1: Compatibility foundation

Deliverables:

- `DiagramState` versioning/migration foundations;
- extension toggle with no extended creation tools yet;
- extension-content scanner;
- compatibility report in the export flow;
- lossless opaque-property infrastructure;
- Undulate JSON detection and shared-subset import/export.

Definition of done:

- ordinary WaveDrom UX is visually unchanged while the toggle is off;
- simple diagrams round-trip through both JSON targets;
- unsupported fields are reported and preserved where promised.

Estimated effort: roughly 1–2 weeks.

### Phase 2: Annotations and styling

Deliverables:

- text annotations;
- vertical/horizontal lines;
- global time-compression annotation;
- selected extended shapes/arrows;
- normalized safe styles;
- selection, move, edit, delete, undo/redo;
- Undulate JSON import/export;
- compatibility reporting for WaveDrom output.

Definition of done:

- annotation fixtures render and round-trip;
- arbitrary text is safely escaped;
- turning extensions off hides without deleting annotations.

Estimated effort: roughly 2–4 weeks depending on interaction polish.

### Phase 3: Fine timing and extended digital behavior

Deliverables:

- integer tick timebase;
- Sub-Steps control and minor grid;
- fine-timing paint, selection, edges, and annotations;
- repeat, slewing, duty cycle, and per-cell period model;
- metastability and impulse states;
- verified Undulate conversion;
- explicit WaveDrom compatibility behavior.

Definition of done:

- no floating-point drift across repeated edits/round trips;
- mixed-resolution diagrams align deterministically;
- fine-timing performance remains interactive.

Estimated effort: roughly 3–6 weeks.

### Phase 4: Long nodes and structured edges

Deliverables:

- semantic node objects;
- structured internal edges;
- long node-name editing;
- deterministic temporary character allocation for WaveDrom;
- Undulate extended edge markers selected from verified support.

Definition of done:

- existing edge fixtures migrate without visual regression;
- long names survive Undulate round trips;
- WaveDrom export gives a precise error when allocation is impossible.

Estimated effort: roughly 2–4 weeks, with overlap possible with Phase 2.

### Phase 5: Analogue lanes and overlays

Deliverables:

- analogue signal type;
- hold, step, capacitive, slew, and explicit sample segments;
- vertical ranges and scaling;
- overlay groups and label positions;
- analogue renderer, selection, hit testing, and export;
- opaque preservation of expressions;
- safe sample-size limits and downsampling.

Definition of done:

- representative mixed-signal fixtures render reliably;
- overlays remain editable and unambiguous;
- no imported expression is executed;
- image and Undulate JSON exports behave as reported.

Estimated effort: roughly 4–8 weeks.

### Phase 6: YAML and TOML

Deliverables:

- safe YAML import/export;
- deterministic TOML import/export;
- file-picker and editor language support;
- format-specific tests and documentation;
- clear statement about comment/formatting preservation.

Definition of done:

- semantic round trips pass for supported fixtures;
- malicious parser fixtures are rejected safely;
- source-format selection is clear in Save As/Export.

Estimated effort: roughly 1–3 weeks.

### Phase 7: Optional advanced work

Candidates:

- constrained mathematical expression language;
- additional Undulate shapes and style properties;
- richer analogue point editor;
- register diagrams;
- additional export formats where browser-native libraries are justified;
- command-line companion or documented use with the external Undulate CLI.

These are not prerequisites for calling the core compatibility work successful.

## 24. Rough overall realism

For one developer working mostly full-time:

| Scope | Realism | Rough effort |
| --- | --- | --- |
| Verify/export ordinary diagrams to Undulate | Very high | 1–3 days |
| Import/export extended Undulate JSON without silent loss | High | 1–2+ weeks |
| Annotations and styling | High | Several weeks |
| Major digital timing extensions | High | Several additional weeks |
| Analogue curves and overlays | High but substantial | One to two additional months |
| Broad feature parity with all formats | Possible, not initially necessary | Multiple months |

These estimates are planning aids, not commitments. The implementation should
be milestone-driven and may combine phases when shared refactors make that more
efficient.

## 25. Risk register

### 25.1 Model complexity

Risk: adding format-specific optional fields directly to `Signal` creates an
unmaintainable union of unrelated meanings.

Mitigation: use semantic types, dedicated extension structures, and bridge-owned
spelling conversions.

### 25.2 WaveDrom regressions

Risk: changing the time and edge models breaks existing round trips or editing.

Mitigation: migrate incrementally, retain golden fixtures, and keep compatibility
adapters isolated.

### 25.3 False interoperability claims

Risk: accepting a property without matching Undulate's geometry is described as
full compatibility.

Mitigation: define exact/converted/approximated/unsupported levels and verify
against pinned upstream rendering.

### 25.4 Expression execution

Risk: imported analogue or timing expressions execute attacker-controlled code.

Mitigation: never execute them; preserve as opaque text or parse a future strict
DSL.

### 25.5 Parser attacks

Risk: YAML aliases, deep objects, or enormous arrays cause resource exhaustion.

Mitigation: safe schema, normalization, depth and size limits, hostile tests.

### 25.6 Overlay usability

Risk: overlapping curves become difficult to select or understand.

Mitigation: explicit overlay groups, label ordering, selection disambiguation,
and focused usability testing.

### 25.7 Format lock-in

Risk: the internal model becomes a mirror of Undulate and makes future formats
hard to support.

Mitigation: model user intent and keep `undulateBridge` responsible for syntax.

### 25.8 Hidden data confusion

Risk: users switch to WaveDrom mode, forget hidden extensions, then make a lossy
export.

Mitigation: persistent hidden-content indicator and export compatibility report.

### 25.9 Upstream inactivity or divergence

Risk: the target project evolves slowly, forks, or changes undocumented details.

Mitigation: pin tested behavior, keep adapters modular, and define compatibility
against versions rather than an abstract promise.

## 26. Decisions already made

The following decisions should be treated as the current direction unless new
evidence warrants revisiting them:

1. The current interface remains the default and should not be broadly
   redesigned.
2. Undulate support is enabled through an optional document-level toggle.
3. The toggle reveals additive controls; it does not create a separate editor.
4. Turning the toggle off hides and locks extensions rather than deleting them.
5. One internal superset model feeds one renderer.
6. WaveDrom and Undulate use separate format adapters.
7. Text annotations are native Undulate-compatible extensions.
8. Sub-Steps are an app-native fine-timing feature translated to Undulate.
9. Unsupported imported properties should be preserved when safely possible.
10. Lossy export requires an explicit compatibility report.
11. Imported Python-like expressions are never executed.
12. JSON support comes before YAML and TOML.
13. Annotations and styling should precede analogue overlays.
14. Python/Cairo is not embedded into the browser app.

## 27. Open design questions

These questions should be resolved with prototypes or fixtures rather than
assumptions:

### Product and files

- Should `.wp` become the documented lossless native project format?
- Should the extension toggle itself be persisted when a document contains no
  extension objects?
- Should opening a shared-subset Undulate YAML file keep extensions enabled
  because of its source format, or disable them because of its content?
- Should Save preserve the source format while Export produces alternate
  formats, or should Save As allow switching the canonical format?

### Timing

- What maximum `ticksPerStep` balances useful fine timing and performance?
- Can all existing WaveDrom subcycle syntax normalize cleanly into ticks and
  serialize back without changing source semantics?
- Does pinned Undulate reliably render fractional `period < 1` across SVG and
  Cairo outputs?
- How should gaps and global compression affect axis numbering?

### Annotations

- Which annotations should anchor to a row versus absolute diagram Y?
- How should annotations behave when their target signal is moved, collapsed,
  hidden, or deleted?
- Should deleting an anchor offer delete, detach, or reassign choices?
- Which Undulate edge markers are stable enough for the first supported set?

### Analogue

- What voltage/range defaults make sense outside Undulate's VDDA/VSSA context?
- Should imported expressions display a placeholder curve, no curve, or a
  previously cached sample representation when available?
- Should sampled curves store raw points, normalized points, or both?
- What downsampling algorithm preserves sharp transitions and extrema?

### Styling

- Which CSS-like units should be accepted for font size?
- Should styles inherit from diagram/group/signal, or remain object-local in
  the first release?
- How much of a custom Undulate stylesheet can be represented safely?

### Compatibility policy

- Which approximations are acceptable, and which should block export?
- Should opaque unsupported content block WaveDrom export even if the user asks
  for a compatible subset?
- How should compatibility versions be shown in the UI and saved metadata?

## 28. Implementation readiness checklist

Before beginning Phase 1:

- [ ] Choose and pin the initial Undulate target revision.
- [ ] Add a license/attribution note for imported upstream fixtures.
- [ ] Create synthetic fixtures for each planned feature.
- [ ] Decide the native project file contract.
- [ ] Specify `DiagramState` version 2 migration behavior.
- [ ] Specify compatibility finding types and UI language.
- [ ] Decide maximum input and timebase limits provisionally.
- [ ] Verify current exported WaveJSON with the pinned Undulate CLI.
- [ ] Record exact handling of `edge` versus `edges`.
- [ ] Record exact long-node syntax.
- [ ] Verify fractional periods below one.

Before releasing any extension feature:

- [ ] Import, export, and semantic round-trip tests pass.
- [ ] Golden renderer tests pass.
- [ ] Existing WaveDrom tests pass unchanged or with reviewed migrations.
- [ ] Security fixtures pass.
- [ ] Undo/redo and dirty-state behavior are covered.
- [ ] Toggle-off behavior preserves extension data.
- [ ] Compatibility report correctly classifies the feature.
- [ ] Image export contains the feature.
- [ ] Documentation names native versus translated support accurately.
- [ ] Privacy and CSP guarantees remain unchanged.

## 29. Suggested first implementation slice

The smallest meaningful vertical slice is not analogue rendering. It is:

1. Add the document-level extensions toggle.
2. Add a typed `annotations` collection to the internal model.
3. Implement one free text annotation with tick/signal anchoring.
4. Render, select, move, edit, delete, undo, and redo it.
5. Export it as an Undulate `annotations` entry.
6. Report it as unsupported for WaveDrom source export.
7. Hide and lock it when the extension toggle is disabled.
8. Preserve it in autosave and the chosen native project format.

This slice exercises nearly every architectural boundary—model, store,
renderer, tools, file formats, compatibility reporting, mode behavior, export,
and security—without first taking on the complexity of analogue curves or
overlay layout.

After that slice is stable, vertical/horizontal lines and global compression
can reuse most of the same infrastructure.

## 30. Reference links

- [Undulate repository](https://github.com/LudwigCRON/undulate)
- [Undulate documentation](https://ludwigcron.github.io/undulate/)
- [Undulate analogue tutorial](https://ludwigcron.github.io/undulate/tutorial_analogue.html)
- [Undulate annotations tutorial](https://ludwigcron.github.io/undulate/tutorial_annotations.html)
- [Undulate supported syntax](https://ludwigcron.github.io/undulate/supported_syntax.html)
- [WavePaint application](https://www.wavepaint.net/app/)
- [WavePaint public repository and issue tracker](https://github.com/lodigic/WavePaint)

## 31. Summary

Undulate support is realistic if treated as an optional, staged extension to
the existing editor rather than a second application or a Python renderer port.

The architecture should preserve four boundaries:

1. **The default interface remains WaveDrom-first.**
2. **The internal model represents meaning rather than file syntax.**
3. **Each exporter states exactly what it can preserve.**
4. **Imported data is never allowed to become executable code.**

Annotations provide the best first vertical slice. Fine timing and Sub-Steps
should follow through an integer tick timebase. Analogue lanes and overlays are
valuable and feasible, but should build on the stable model, layout, annotation,
and compatibility foundations established in the earlier phases.
