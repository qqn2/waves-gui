# Sub-cycle wave syntax

WaveDrom supports compressed step notation inside a single column, for example `x74...<5|>5..9x` (see [wavedrom#387](https://github.com/wavedrom/wavedrom/issues/387)).

This editor parses and renders structurally valid sub-cycle syntax on scalar bit lanes. The WaveDrom bridge expands the states between `<` and `>` into levels within a single canvas column while preserving gap markers such as `|`.

The code panel rejects nested, empty, unbalanced, or unmatched markers. An opening marker needs a preceding state, and a closing marker needs a following state; for example, `0<1>1` is valid while `<1>0`, `0<>1`, and `0<1>` are not.

Sub-cycle rendering is a WaveDrom bridge compatibility feature. Editing
operations preserve wave-canonical storage for these lanes, and complex vector
semantics inside WaveDrom's `<...>` notation are not inferred. Undulate mode
provides the separate general fine-timing model: integer sub-steps, repeat,
per-cell periods, duty cycles, phase, and slew. Preview geometry may differ
from upstream WaveDrom for sub-cycle edge cases outside the scalar expansion
model.
