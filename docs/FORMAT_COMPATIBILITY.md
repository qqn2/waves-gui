# Format compatibility

Conformance baseline audited: 2026-07-30

waves-gui is a visual editor for WaveDrom diagrams and the declarative
waveform features documented by Undulate at revision
[`c8da7d48c48fc0bbc90113b6913611132bd96c01`](https://github.com/LudwigCRON/undulate/tree/c8da7d48c48fc0bbc90113b6913611132bd96c01).

The former implementation checklist, plan, and fine-timing design remain available in Git history; this document is the maintained product contract.

## Compatibility guarantee

Input accepted by the application receives one of three explicit treatments:

1. **Modeled:** waves-gui can edit, render, and export the feature.
2. **Preserved:** safe declarative data that is not modeled remains attached
   to its object, round-trips opaquely, and appears in compatibility findings.
3. **Rejected:** malformed, unsafe, over-limit, or intentionally excluded input
   is rejected with an explanation before it can replace the current diagram.

Accepted content is never silently discarded. Deleting an object that owns
preserved data creates an explicit orphan finding. Exporting to a less capable
format displays the affected features before conversion.

This is semantic compatibility. waves-gui uses its own browser renderer and
does not promise pixel-identical output with WaveDrom or Undulate backends.

## Documents and interchange

| Document syntax | Import | Visual editing | Source-aware save | Export |
| --- | --- | --- | --- | --- |
| WaveDrom JSON/JSON5/JSONML | Yes | Yes | Yes | Yes |
| Undulate JSON/JSONML | Yes | Yes | Yes | Yes |
| Undulate YAML 1.2 | Yes | Yes | Yes | Yes |
| Undulate TOML | Yes | Yes | Yes | Yes |
| VCD | Import only | After conversion | As a diagram | As a diagram |

JSON5/JSONML, YAML, and TOML retain comments and compatible local syntax where
practical. Structural changes use deterministic canonical syntax. Byte-for-byte
source identity is not part of the contract.

The code panel can convert an Undulate document among JSON, YAML, and TOML.
Conversion changes the subsequent save format and detaches an incompatible
retained file handle so the original file is not overwritten with another
syntax.

## Waveform support

WaveDrom support includes digital, clock, bus, grouped and spacer lanes;
labels, nodes, edges, phase, period, gaps, headers, footers, ticks, tocks,
scaling, and supported skins.

Undulate extensions include:

- metastability, impulse, held-edge, pull-up, and pull-down digital states;
- expanded node identifiers and endpoint markers;
- integer sub-step timing, repeat, per-cell periods, duty-cycle arrays, phase,
  and digital slew;
- analogue hold, step, capacitive, sampled-curve, metastability, and impulse
  cells;
- voltage rails, safe documented expressions, deterministic random seeds,
  analogue slew, vertical scaling, and overlay groups;
- text, line, time-compression, and structured-arrow annotations with
  node/coordinate anchors and direct canvas editing;
- bounded local signal and annotation colors, fills, stroke widths, dash
  patterns, font sizes, generic font families, and numeric font weights.

Safe analogue expressions use a bounded parser for documented constants,
arithmetic, and math functions. Imported JavaScript or Python is never
executed.

## Rendering and export

The browser-native renderer supplies the interactive canvas and local preview.
The same app geometry feeds:

- SVG;
- PNG and JPEG at 1x, 2x, or 3x;
- single-page PDF;
- Level 2 EPS;
- deterministic UTF-8 terminal text;
- WaveDrom-compatible JSON;
- Undulate JSON, YAML, and TOML.

WaveDrom export reports Undulate-only content and offers an explicit compatible
subset. Strict Undulate export removes namespaced waves-gui metadata and
resolves app-owned voltage or random context to portable values.

## Safety boundaries

Resource limits are compatibility guarantees: input outside them is rejected
instead of truncated or silently normalized.

- Fine timing uses at most 1024 integer ticks per major step.
- A document may contain at most 1000 annotations.
- Annotation text is limited to 2000 characters.
- Sampled analogue cells contain at most 4096 points.
- Analogue values are bounded to ±1,000,000,000.
- Analogue `vscale` is bounded from 0.25 through 16.
- An analogue overlay contains at most four waves.
- Stroke width is bounded from 0 through 32.
- Dash arrays contain 1 through 16 finite values, each from 0 through 1000.
- Font sizes normalize into the safe 6px through 96px range.

YAML aliases, anchors, merge keys, explicit tags, unsafe object keys,
non-finite values, excessive nesting, and oversized documents are rejected.
Equivalent duplicate, unsafe, non-finite, lossy, and resource-limit checks
apply to JSON and TOML.

## Permanent exclusions

- Register diagrams.
- Arbitrary code execution.
- Unsafe remote resources and arbitrary CSS execution.
- Embedding or invoking Undulate's Python/Cairo renderer, or promising exact
  implementation/backend reproduction.

These are deliberate product boundaries rather than unfinished checklist
items.

## Conformance evidence

The compatibility contract is enforced by this project’s revision-pinned source audit, property matrix, fixture corpus, and automated tests:

- `src/undulateBridge/validation.ts`
- `src/undulateBridge/manifestConsistency.test.ts`
- `src/undulateBridge/certificationCorpus.test.ts`
- `src/undulateBridge/undulateJSON.test.ts`
- `src/undulateBridge/undulateYAML.test.ts`
- `src/undulateBridge/undulateTOML.test.ts`
- `src/undulateBridge/upstreamRoundTrip.test.ts`
- `src/undulateBridge/visualConformance.test.ts`
- `tests/fixtures/undulate/supported-roundtrip-cases.json`
- `tests/fixtures/undulate/property-matrix.json`
- `tests/fixtures/undulate/certification-corpus.json`
- `tests/fixtures/undulate/visual/reference/`
- `tests/e2e/release.spec.ts`

The source audit used Undulate's pinned
[supported-syntax documentation](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/supported_syntax.rst)
and parser implementations for
[JSONML](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/src/undulate/parsers/jsonml.py),
[YAML](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/src/undulate/parsers/yaml.py), and
[TOML](https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/src/undulate/parsers/toml.py).

Supporting a newer upstream revision requires a new revision-pinned audit and
fixtures. It does not silently broaden this contract.
