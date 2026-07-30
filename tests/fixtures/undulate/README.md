# Undulate fixtures

These small, synthetic, license-compatible fixtures follow the annotation
schema documented by Undulate revision
`c8da7d48c48fc0bbc90113b6913611132bd96c01`.

Reference:
<https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_ann_step2.rst>

## Machine-readable certification inventories

`property-matrix.json` is the revision-pinned feature/property matrix. Every
documented declarative property or value form is classified as exactly one of:

- **modeled** — imported, edited where product-relevant, rendered, and exported
- **opaque** — safely preserved verbatim with an explicit compatibility report
- **rejected** — unsafe or permanently excluded

`certification-corpus.json` is the provenance-tracked fixture corpus. Each case
records source repository, exact commit SHA, original path or documentation
section, license, and whether it is copied verbatim or minimally adapted. Cases
cover pinned Undulate tutorials, format comparison, native JSON/YAML/TOML
equivalents, representative WaveDrom timing/edge examples, opaque-preservation
paths, and negative fixtures for register diagrams, executable expressions,
remote CSS, and oversize input.

YAML and TOML are Undulate interchange formats, not native WaveDrom formats.
Cross-format cases prove equivalent semantics without calling YAML/TOML
“WaveDrom formats.”

## Existing fixtures

`blocked-features.json` is a deliberately blocked classifier fixture. It
combines permanently excluded register diagrams with safe opaque unknown
fields and supported analogue expressions. It must produce findings without
being imported when a blocking finding is present.

`supported-roundtrip-cases.json` is a table of strict-JSON conformance cases
derived from the pinned tutorials. Each case records the upstream tutorial
source, the supported features it proves, its deterministic canonical export,
and text that must appear in the app's SVG renderer. The source project is MIT
licensed; these compact cases are synthetic adaptations rather than copied
output artifacts. The shared sub-cycle case points to the separately vendored
WaveDrom reference used by that compatibility subset.

`visual/reference` contains SVG output produced by the same pinned Undulate
revision for the first digital and analogue tutorials. These MIT-licensed
reference artifacts are kept offline so CI never depends on the documentation
website. `visualConformance.test.ts` crops away labels, ticks, themes, and
layout differences, rasterizes only waveform geometry, and compares it with a
small anti-aliasing tolerance. A failure writes a red (upstream-only) and blue
(local-only) diagnostic image under `test-results/undulate-visual`.

## Automated consumers

- `src/undulateBridge/manifestConsistency.test.ts`
- `src/undulateBridge/certificationCorpus.test.ts`
- `src/undulateBridge/upstreamRoundTrip.test.ts`
- `src/undulateBridge/visualConformance.test.ts`
- `src/undulateBridge/undulateJSON.test.ts`
