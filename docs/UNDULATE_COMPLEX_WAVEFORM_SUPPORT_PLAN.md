# Undulate Complex Waveform Support Plan

## Status

Implementation plan for an execution agent. This document freezes the scope,
data-model decisions, file targets, tests, and completion criteria for importing,
rendering, editing, and round-tripping the complex Undulate document supplied in
the task.

The execution agent must implement the phases in order and run each phase gate
before continuing. Do not redesign unrelated UI or broaden the expression
language beyond the grammar specified here.

## Objective

Make the supplied document pass this complete flow:

```text
Undulate JSON
  -> validation
  -> import
  -> native canvas/SVG rendering
  -> non-destructive editor representation
  -> Undulate JSON export
  -> reimport
```

The document exercises:

- extended digital states: `x`, `z`, `u`, `d`, `=`, `2` through `9`,
  `i`, `I`, `m`, and `M`;
- clock and held-edge states: `p`, `P`, `n`, `N`, `h`, `H`, `l`, and `L`;
- nested groups and blank spacer rows;
- buses with string or array `data`;
- gap columns using `|`;
- scalar `period`, `phase`, `repeat`, and `slewing`;
- analogue `a`, `s`, and `c` cells with `vscale` and `slewing`;
- safe sampled-curve expressions using
  `[(t, expression) for t in time]`;
- generated numeric arrays using
  `[expression for i in range(N)]`;
- a generated period sequence whose first value is zero.

Most digital, grouping, bus, gap, and analogue rendering already exists. The
implementation must extend the current bridge rather than introduce a second
renderer.

## Frozen decisions

### 1. No arbitrary code execution

Never use `eval`, `Function`, Python, a subprocess, or an external expression
runtime. Extend the existing bounded expression parser only.

### 2. Generated-sequence grammar is intentionally narrow

Support exactly this outer form in the first implementation:

```text
[arithmetic_expression for i in range(N)]
```

Rules:

- the loop variable must be exactly `i`;
- `N` must be a non-negative integer literal;
- only one-argument `range(N)` is supported;
- maximum `N` is `10_000`;
- the arithmetic expression may use `i`, `VDDA`, `VSSA`, and `pi`;
- operators are `+`, `-`, `*`, `/`, `**`, and `%`;
- supported functions remain the existing bounded math functions;
- `rnd()` is not supported inside generated sequences in this phase;
- every result must be finite and have absolute value at most `1_000_000_000`;
- list literals, nested comprehensions, conditions, indexing, attributes,
  imports, and function definitions remain rejected.

Keep the existing curve form unchanged:

```text
[(t, expression) for t in time]
```

### 3. Generated fields are resolved before the existing import pipeline

The existing importer and renderer continue to consume concrete arrays. A new
resolution step evaluates supported generated strings into arrays, returns a
resolved clone, and records source provenance by flattened signal index.

Do not mutate the caller's parsed JSON object.

### 4. Original expressions round-trip while their results are unchanged

Store each original generated expression together with a fingerprint of the
imported concrete values. Export the expression string only while the current
modeled values still match that fingerprint. Once the user changes the affected
cells, export a concrete array.

Never emit a stale expression after an edit.

### 5. Analogue repeat validation uses the expanded wave

For an analogue signal, the required value count is:

```ts
const expandedWave = signal.wave.repeat(signal.repeat ?? 1);
const requiredValues = [...expandedWave]
  .filter((character) => /[sca]/.test(character))
  .length;
```

This makes `wave: "a...", repeat: 4` consume four analogue values.

### 6. Zero periods are modeled as collapsed source cells

The supplied adaptive clock starts with period zero. Support it without silently
clamping it to one tick.

- Imported Undulate timing cells may have `durationTicks === 0`.
- Zero-duration cells occupy no horizontal space and have no pointer hit area.
- Rendering skips zero-width geometry but preserves the source state/cell.
- Export preserves zero exactly.
- GUI-created or GUI-edited durations remain at least one tick; zero is an
  import/source-code capability, not a new inspector value.
- A period array containing only zero values is invalid because it creates a
  lane with no extent.
- Negative periods remain invalid.

Do not silently normalize zero to one.

## Non-goals

- General Python syntax.
- JavaScript expressions.
- Arbitrary iterable or multi-variable comprehensions.
- Conditional comprehensions.
- General zero-duration creation through Draw-mode controls.
- New waveform state types.
- A new renderer.
- Changes to the Sample Library UI.
- Changes to WaveDrom JSON compatibility rules. Generated sequence strings are
  Undulate-only.

## Current implementation facts

Use these existing paths rather than replacing them:

- `src/shared/analogueExpressions.ts` contains the safe arithmetic parser and
  curve evaluator.
- `src/undulateBridge/validation.ts` validates analogue values and digital
  timing arrays.
- `src/undulateBridge/undulateJSON.ts` imports analogue cells, digital timing,
  repeat metadata, and exports Undulate JSON.
- `src/shared/fineTiming.ts` converts periods and duty cycles into integer ticks.
- `src/renderer/laneTiming.ts` maps timing cells onto X coordinates.
- `src/renderer/renderBitSignal.ts` and `src/exportEngine/exportSVG.ts` render
  timed digital cells.
- `src/shared/normalizeDiagram.ts` currently forces durations to at least one
  tick and must be changed carefully for imported zero-duration cells.

## Phase 0 - Add the exact regression fixture

### Files

- Add `tests/fixtures/undulate/complex-waveform.json`.
- Add a focused test section in `src/undulateBridge/undulateJSON.test.ts`, or a
  new `src/undulateBridge/complexWaveform.test.ts` if that keeps the existing
  test file manageable.

### Work

1. Copy the supplied JSON document verbatim into the fixture. Do not simplify
   it and do not replace expression strings with arrays.
2. Add one initial test that reads the fixture and records the current blocking
   validation error. Mark this as a temporary characterization assertion.
3. Add helpers in the test only for flattening groups and locating a signal by
   name. Do not add production helpers merely for tests.

### Phase gate

The new characterization test passes and proves the fixture is loaded exactly
as supplied. Do not continue if the fixture was normalized or edited.

## Phase 1 - Safe generated numeric sequences

### Files

- Modify `src/shared/analogueExpressions.ts`.
- Modify or add `src/shared/analogueExpressions.test.ts`.

### API

Add:

```ts
export const UNDULATE_SEQUENCE_MAX_VALUES = 10_000;

export function evaluateUndulateSequence(
  source: string,
  context?: AnalogueContext,
): number[];

export function validateUndulateSequence(
  source: string,
  context?: AnalogueContext,
): string | null;
```

Use `DEFAULT_ANALOGUE_CONTEXT` when context is omitted.

### Parser changes

1. Add `%` to the tokenizer's operator type.
2. Give `%` the same precedence as `*` and `/`.
3. Reject modulo by zero explicitly.
4. Add a narrow outer parser for
   `[expression for i in range(N)]`.
5. Parse the inner expression once, then evaluate it for `i = 0` through
   `N - 1`.
6. Reuse the existing finite-result checks.
7. Reject `rnd()` for generated sequences with a stable error message.

### Required tests

- `[i/16 for i in range(16)]` returns 16 values from `0` through `15/16`.
- `[i/8 for i in range(16)]` returns a leading zero.
- `[0.4*(i%4)+0.1 for i in range(16)]` returns the expected repeating values.
- `[0.4*(3-i%4)+0.1 for i in range(16)]` returns the reverse pattern.
- `range(0)` returns an empty array at the evaluator level.
- `range(10001)` is rejected.
- modulo by zero is rejected.
- an unknown variable is rejected.
- a different loop variable is rejected.
- nested or conditional comprehensions are rejected.
- Python imports and JavaScript syntax are rejected.
- existing scalar and curve-expression tests remain unchanged and passing.

### Phase gate

Run:

```text
npm test -- --run src/shared/analogueExpressions.test.ts
```

Do not proceed until all existing expression-security tests also pass.

## Phase 2 - Resolve generated fields and fix analogue repeat validation

### Files

- Modify `src/wavedromBridge/wdTypes.ts` only as needed for TypeScript unions.
- Modify `src/undulateBridge/types.ts`.
- Modify `src/undulateBridge/validation.ts`.
- Modify `src/undulateBridge/undulateJSON.ts`.
- Modify the complex-waveform test.

### Accepted field forms

For Undulate input only:

```ts
analogue: UndulateAnalogueValue[] | string;
periods: number[] | string;
duty_cycles: number[] | string;
```

WaveDrom validation must continue rejecting these strings unless the document
is recognized and processed as Undulate.

### Resolution helper

Add an internal helper in `undulateJSON.ts`, unless extracting a small module
materially improves testability:

```ts
interface GeneratedSequenceSource {
  field: 'analogue' | 'periods' | 'duty_cycles';
  source: string;
  values: number[];
  fingerprint: string;
}

interface ResolvedUndulateDocument {
  root: UndulateRoot;
  bySignalIndex: Map<number, GeneratedSequenceSource[]>;
}
```

The helper must:

1. deep-clone the input;
2. walk nested groups in the same order as `flattenRawSignals()`;
3. evaluate supported string fields;
4. replace those fields with concrete arrays in the clone;
5. return provenance keyed by flattened non-spacer signal index;
6. never execute input as code.

### Validation changes

1. Detect analogue signals by presence of the `analogue` property, not only by
   `Array.isArray()`.
2. Validate a string `analogue`, `periods`, or `duty_cycles` using
   `validateUndulateSequence()`.
3. Perform cardinality and value-range validation against resolved values.
4. For analogue lanes, count `s`, `c`, and `a` in the repeated wave.
5. For digital timing, require one generated value per expanded wave cell,
   preserving the current `wave.length * repeat` rule in this phase.
6. `analogue` sequence results must match the repeated count of `s/c/a` cells.
7. `periods` values must be finite and greater than or equal to zero, with at
   least one positive value for a non-empty lane.
8. `duty_cycles` values must remain within `0..1` inclusive.
9. Keep the existing 1024-tick lossless-resolution limit.

### Import changes

1. Resolve generated sequences once at the start of `fromUndulateJSON()`.
2. Use the resolved clone for WaveDrom-compatible conversion, raw-signal
   flattening, timing resolution, and analogue import.
3. Attach provenance to the corresponding internal signal.
4. Do not change existing behavior for concrete arrays.
5. Preserve the existing compact analogue repeat metadata for array-authored
   signals.

### Internal provenance

Add this optional field to `Signal` in `src/shared/types.ts`:

```ts
undulateGeneratedSequences?: Partial<Record<
  'analogue' | 'periods' | 'duty_cycles',
  {
    source: string;
    values: number[];
    fingerprint: string;
  }
>>;
```

Clone this metadata anywhere signals are deep- or structurally cloned. A JSON
deep clone already preserves it, but explicit signal clone helpers must be
audited.

### Tests

- `GBF` resolves to 16 analogue cells and four sampled cells.
- Its four different curve expressions map to the four repeated `a` cells in
  source order.
- `INT_S` and `INT_C` each resolve to 16 analogue cells.
- Their generated values match the expected repeating sequences.
- PWM resolves 16 duty-cycle values.
- Adaptive clock resolves 16 period values including the leading zero.
- Invalid sequence syntax reports the signal path and field.
- Cardinality mismatches are rejected after sequence evaluation.
- Existing concrete-array fixtures still round-trip identically.

### Phase gate

The exact fixture passes structural and expression validation. It is acceptable
for import to remain blocked only by zero-duration model assertions until Phase
3 is complete.

## Phase 3 - Model zero-duration imported cells

This phase is required for the supplied document as written. Do not replace it
with clamping.

### Files to modify and audit

- `src/shared/types.ts`
- `src/shared/fineTiming.ts`
- `src/shared/normalizeDiagram.ts`
- `src/shared/timedStepResize.ts`
- `src/shared/bitStepResize.ts`
- `src/shared/store/stepColumnHelpers.ts`
- `src/renderer/laneTiming.ts`
- `src/renderer/renderBitSignal.ts`
- `src/exportEngine/exportSVG.ts`
- any test failures that reveal another positive-duration assumption

### Data-model invariant

Change the `TimedCell.durationTicks` documentation and normalization invariant
from positive to non-negative for imported timing cells.

New GUI-created durations still use `Math.max(1, ...)`.

### Required code behavior

1. `timingForCellCount()` must preserve a resolved zero period as zero ticks.
   Distinguish an explicit zero from an absent/invalid value; do not use `||`
   fallbacks.
2. `normalizeSignalTiming()` must preserve finite zero values and continue to
   repair missing, negative, or non-finite values safely.
3. Duration sums must use `Math.max(0, durationTicks)`, not `Math.max(1, ...)`.
4. Rescaling must leave zero as zero.
5. `lanePeriod()` must not return zero as the generic fallback width. For a
   timed lane whose first cell is collapsed, use the first positive cell
   duration, or one major step if no positive cell is available.
6. `stepLogicalX()` and `stepLogicalXEnd()` may return the same coordinate for
   a collapsed cell.
7. `stepFromLogicalX()` and hit testing must skip zero-width cells. They must
   not loop forever and must select the first later cell containing the point.
8. `renderBitSignal.ts` and SVG export must skip geometry for `nextX <= x`.
   They must not divide by a zero duration when computing duty ratio.
9. Resize/split helpers must advance over zero-duration cells without consuming
   requested duration and without looping forever.
10. Source-code edits may preserve or remove zero cells. Draw-mode timing edits
    continue creating values of at least one tick.
11. No SVG, canvas coordinate, exported JSON, or internal field may contain
    `NaN` or `Infinity`.

### Required tests

- A timing track `[0, 1, 2]` retains zero after normalization.
- Its first cell has identical left and right X coordinates.
- The second cell starts at the same X coordinate.
- Hit testing at that coordinate selects the second visible cell, not the
  collapsed first cell.
- Document width equals the sum of non-negative durations.
- Rendering and SVG export contain no `NaN` or `Infinity`.
- Saving Undulate JSON emits the leading zero.
- Timing rescale keeps zero at zero.
- Resize helpers terminate and retain valid ordering when zero cells exist.
- Existing positive-duration timing tests remain unchanged and passing.

### Phase gate

Run all focused timing, lane-geometry, renderer, and export tests. Do not move
on while any positive-duration regression remains.

## Phase 4 - Expression provenance and export behavior

### Files

- Modify `src/undulateBridge/undulateJSON.ts`.
- Modify `src/shared/types.ts` if the Phase 2 metadata shape needs refinement.
- Extend the complex-waveform test.

### Fingerprints

Use deterministic JSON fingerprints:

- `analogue`: evaluated numeric sequence associated with generated `s/c` cells;
- `periods`: each timing cell's `durationTicks / ticksPerStep`;
- `duty_cycles`: each timing cell's duty ratio, using the same default behavior
  as `applyTimingFields()`.

Do not fingerprint object IDs.

### Export rules

1. Build the normal concrete Undulate entry first.
2. Compare its modeled concrete values with stored provenance.
3. If unchanged, replace the concrete field with the original source string.
4. If changed, emit the concrete array and remove stale provenance from the
   exported representation.
5. Preserve unrelated compact `repeat` spelling where existing fingerprint
   logic permits it.
6. Strict Undulate export may preserve these safe expressions because they are
   part of the supported declarative subset.
7. WaveDrom-compatible export must continue reporting/dropping Undulate-only
   fields through its existing compatibility path.

### Tests

- Import and immediate export preserve all four supplied generated strings
  exactly.
- Reimporting that export produces the same modeled diagram.
- Editing one `INT_S` value converts only its `analogue` expression to an
  explicit array.
- Editing one PWM duty value converts only `duty_cycles` to an array.
- Editing one adaptive-clock duration converts only `periods` to an array.
- Unedited expressions on sibling signals remain strings.

### Phase gate

The supplied document completes a stable import/export/reimport cycle and no
expression is stale after an edit.

## Phase 5 - Full-document rendering and conformance tests

### Tests

Using the exact fixture, assert:

- validation returns `null`;
- all seven top-level test groups import with their nested group names;
- spacer rows remain spacers;
- expected signal names are present;
- `Alfa` retains the extended state sequence;
- `SAlfa` imports numeric slew;
- clocks retain lower/upper and held-edge states;
- buses retain their four labels;
- gap columns survive import and export;
- `CK` repeat and `CMD`/`ADDR` phase timing survive;
- `DQS` metastability cells render;
- `GBF`, `INT_S`, and `INT_C` render as analogue lanes;
- PWM duty cycles and adaptive periods are represented in native timing;
- SVG contains representative labels from tests 1 through 7;
- SVG contains no `NaN`, `Infinity`, `undefined`, or executable source text;
- immediate Undulate export preserves the safe generated expressions;
- a second import/export is stable.

Add a visual-conformance case only after the semantic assertions pass. Keep the
visual crop focused on test 7 so the fixture does not make image tests
unnecessarily large.

## Phase 6 - Documentation and compatibility manifest

### Files

- Update `docs/FORMAT_COMPATIBILITY.md`.
- Update `tests/fixtures/undulate/property-matrix.json`.
- Update `tests/fixtures/undulate/certification-corpus.json` or the supported
  round-trip fixture manifest, whichever matches the existing classification.

### Documentation changes

Document:

- the exact generated-sequence grammar;
- supported variables, operators, and functions;
- the 10,000-value limit;
- field-specific bounds;
- expression preservation until modeled values change;
- zero periods as collapsed, source-authored cells;
- the fact that Draw-mode controls still create positive durations;
- continued rejection of arbitrary code.

Classify generated `analogue`, `periods`, and `duty_cycles` forms as modeled,
not opaque.

## Required final verification

Run these commands from the repository root:

```text
npm run confidentiality:check
npm run lint
npm test
npm run test:visual
npm run test:security
npm run build
npm run licenses:check
```

Also run:

```text
git diff --check
git status --short
```

The build's existing third-party `eval` and chunk-size warnings are not caused
by this work. New warnings, test failures, generated-file drift, or unrelated
source changes are not acceptable.

## Suggested commit boundaries

1. `Add safe Undulate sequence expressions`
2. `Resolve generated Undulate waveform fields`
3. `Support collapsed Undulate timing cells`
4. `Preserve generated expressions on round trip`
5. `Certify complex Undulate waveform support`

Each commit must pass its focused tests. The final commit must pass the complete
verification list.

## Acceptance criteria

Implementation is complete only when all conditions below are true:

- The exact supplied JSON validates without preprocessing by the user.
- No input expression is executed as Python or JavaScript.
- All supplied digital, clock, bus, group, spacer, gap, analogue, phase,
  period, repeat, slew, and vertical-scale features render.
- Generated sequence values are bounded and deterministic.
- Analogue value cardinality accounts for `repeat`.
- The leading zero adaptive-clock period is represented as a collapsed cell,
  not silently changed to a positive duration.
- Immediate Undulate export preserves original generated expressions.
- Editing a generated result exports concrete arrays rather than stale source.
- WaveDrom compatibility behavior does not regress.
- Existing Undulate concrete-array fixtures remain byte-for-byte canonical at
  the object level.
- Renderer and export output contain no non-finite coordinates or values.
- All focused and full project checks pass.

## Stop conditions for the execution agent

Stop and report evidence instead of guessing if any of these occurs:

- The supplied fixture differs from the task payload.
- Supporting zero-duration cells requires changing the meaning of positive
  GUI-authored timing cells.
- An existing test establishes that zero must be normalized to one for imported
  Undulate source.
- Generated sequence support would require arbitrary code execution.
- Stable signal-to-provenance mapping cannot be maintained through nested
  groups and spacers.
- Existing WaveDrom JSON begins accepting Undulate-only expression strings.

Do not work around a stop condition by weakening validation, skipping security
tests, or emitting stale source expressions.
