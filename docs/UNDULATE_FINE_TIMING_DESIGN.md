# Undulate Fine-Timing Design

Status: accepted implementation foundation

Target revision:
`c8da7d48c48fc0bbc90113b6913611132bd96c01`

## Goal

Support Undulate digital `repeat`, `periods`, `duty_cycle`,
`duty_cycles`, and digital/clock `slewing` without floating-point drift or
silent normalization. The existing one-cell-per-major-step editor remains the
default view when no fine timing is present.

## Timebase decision

- A document has one positive integer `ticksPerStep`.
- One existing major waveform step spans exactly `ticksPerStep` ticks.
- All transition positions, cell durations, phase offsets, and duty boundaries
  are stored as integers.
- Start with `ticksPerStep = 1` for existing documents.
- Imported finite numbers are converted to bounded rational values. Their
  denominators contribute to the document-wide least common multiple.
- The initial safety limit is `MAX_TICKS_PER_STEP = 1024`.
- If an imported value cannot be represented at or below that resolution, the
  import is rejected as WIP/invalid before the current document is changed.
- Export divides integer ticks by `ticksPerStep`; it never reconstructs timing
  from rendered pixels.

This preserves common decimal duty cycles and periods exactly at the semantic
number level while preventing adversarial denominators from allocating an
unbounded timeline.

## Model direction

Fine-timed digital lanes use a typed timeline as their source of truth:

```ts
interface DigitalTimingCell {
  state: BitState;
  durationTicks: number;
  dutyTicks?: number;
}

interface DigitalTiming {
  phaseTicks: number;
  cells: DigitalTimingCell[];
  slewing?: number;
}
```

Ordinary lanes continue using `states[]` until a fine-timing property is
imported or the user enables Sub-Steps. A fine-timed lane derives a
one-value-per-major-step compatibility cache for existing selection and
overview UI; exporters and renderers read the typed timeline.

The model must not keep two independently editable sources of truth. Any edit
to a fine-timed lane updates the timeline first and regenerates its cache.

## Undulate conversion

- Scalar `period` establishes the default cell duration.
- `periods[index]` overrides the duration for its corresponding consuming wave
  cell.
- Scalar `duty_cycle` establishes the default active fraction for clock cells.
- `duty_cycles[index]` overrides the matching clock cell.
- `phase` converts to an integer `phaseTicks` offset.
- Digital/clock `slewing` remains a bounded finite geometry coefficient; it is
  not quantized as time.
- `repeat` expands the typed cell sequence during import. Until lossless source
  provenance is implemented, export emits the semantically equivalent expanded
  sequence and reports the conversion.
- Array lengths and duty boundaries must match the pinned Undulate contract.
  Mismatches are rejected rather than padded, truncated, or guessed.

## Rendering and editing

- Lane X geometry is accumulated from integer cell durations.
- Clock duty boundaries use `dutyTicks`, not a percentage of a rounded pixel
  width.
- Hit testing converts the pointer X coordinate to the containing tick and then
  to a cell.
- Sub-Steps exposes divisors of `ticksPerStep`; changing resolution previews
  affected timing and is blocked if any existing position would become
  fractional.
- WaveDrom export is exact only when the timed lane maps to its supported scalar
  `period`/`phase` or sub-cycle syntax. Otherwise it produces a blocking
  compatibility finding.

## Delivery order

1. Add rational conversion, limits, and hostile-input tests.
2. Add the typed timeline and versioned normalization.
3. Import/export scalar and per-cell periods.
4. Import/export scalar and per-cell duty cycles.
5. Render and edit digital/clock slewing.
6. Add tick-based hit testing and Sub-Steps controls.
7. Add performance coverage for long and mixed-resolution lanes.
8. Mark each property supported only after its individual delivery record is
   complete.

## Required regression gates

- Existing WaveDrom diagrams retain identical canonical output.
- Undo/redo, autosave, JSON editing, image export, and compatibility reporting
  cover fine-timed lanes.
- Numeric, array-length, overflow, denominator, and resource-limit failures
  leave the current document and file handle unchanged.
- Canvas, SVG, PNG, and JPEG share the same tick-derived geometry.
