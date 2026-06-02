# Sub-cycle wave syntax (deferred)

WaveDrom supports compressed step notation inside a single column, for example `x74...<5|>5..9x` (see [wavedrom#387](https://github.com/wavedrom/wavedrom/issues/387)).

This editor does **not** parse or render sub-cycle syntax today. The code panel validator rejects wave strings containing `<` or `>` with a clear message.

**Workaround:** Author sub-cycle diagrams in [wavedrom.com/editor](https://wavedrom.com/editor.html), then paste or open the JSON here. Import preserves the wave string; canvas rendering may not match until sub-cycle support is implemented.

**Future spike:** Map sub-cycles to expanded `totalSteps` or fractional lane timing; validate against upstream golden SVG before enabling.
