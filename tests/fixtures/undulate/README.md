# Undulate fixtures

These small, synthetic, license-compatible fixtures follow the annotation
schema documented by Undulate revision
`c8da7d48c48fc0bbc90113b6913611132bd96c01`.

Reference:
<https://github.com/LudwigCRON/undulate/blob/c8da7d48c48fc0bbc90113b6913611132bd96c01/docs-srcs/tutorial_ann_step2.rst>

`blocked-features.json` is a deliberately blocked classifier fixture. It
combines documented WIP properties and values, unsupported-by-design register
and expression content, and unknown properties. It must produce findings
without being imported.

`supported-roundtrip-cases.json` is a table of strict-JSON conformance cases
derived from the pinned tutorials. Each case records the upstream tutorial
source, the supported features it proves, its deterministic canonical export,
and text that must appear in the app's SVG renderer. The source project is MIT
licensed; these compact cases are synthetic adaptations rather than copied
output artifacts. The shared sub-cycle case points to the separately vendored
WaveDrom reference used by that compatibility subset.
