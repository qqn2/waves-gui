# Sub-cycle wave syntax

WaveDrom supports compressed step notation inside a single column, for example `x74...<5|>5..9x` (see [wavedrom#387](https://github.com/wavedrom/wavedrom/issues/387)).

This editor parses and renders structurally valid sub-cycle syntax on scalar bit lanes. The WaveDrom bridge expands the states between `<` and `>` into levels within a single canvas column while preserving gap markers such as `|`.

The code panel rejects nested, empty, unbalanced, or unmatched markers. An opening marker needs a preceding state, and a closing marker needs a following state; for example, `0<1>1` is valid while `<1>0`, `0<>1`, and `0<1>` are not.

Sub-cycle rendering is a bridge compatibility feature rather than a general fractional-time model. Editing operations preserve wave-canonical storage for these lanes. Complex vector/data semantics and arbitrary fine-timing authoring remain outside the supported subset, and preview geometry may differ from upstream WaveDrom for edge cases that are not covered by the scalar expansion model.
