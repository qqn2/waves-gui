# WaveDrom reference sources (vendored)

Local copies and links for WaveJSON / WaveDrom behavior. Refresh manually when upstream changes.

## Official documentation

| Resource | URL | Local copy |
|----------|-----|------------|
| WaveJSON schema notes | https://github.com/wavedrom/schema/blob/master/WaveJSON.md | `WaveJSON.md` |
| WaveDrom engine README | https://github.com/wavedrom/wavedrom | `README-wavedrom.md` |
| Hitchhiker's tutorial | http://wavedrom.com/tutorial.html | (online only; see [format compatibility](../FORMAT_COMPATIBILITY.md)) |
| Online editor | http://wavedrom.com/editor.html | — |
| JSON schema repo | https://github.com/wavedrom/schema | — |

## Upstream test fixtures (timing + other)

Pinned WaveDrom revision for conformance adaptations:
[`da34dd29435ae1b8bc35d305e844e8766d522af5`](https://github.com/wavedrom/wavedrom/tree/da34dd29435ae1b8bc35d305e844e8766d522af5/test).

Local copies below were originally downloaded from trunk and are retained as compact reference material. Conformance corpus cases in `tests/fixtures/undulate/certification-corpus.json` adapt timing, arcs, nodes, edges, head/foot, and JSONML-compatible semantics from that pinned revision without copying the entire upstream test directory.

| File | Diagram kind | Use in this project |
|------|----------------|---------------------|
| `signal-step4.json5` | Timing (`signal`) | Period/phase/gap reference; corpus adapts semantics |
| `signal-arcs.json5` | Timing + `edge` + `node` | Edge/node reference; corpus adapts semantics |
| `signal-arcs1.json5` | Timing + arcs variant | Same |
| `reg-vl.json5` | Register (`reg`) | Out of scope for GUI editor |
| `assign.json5` | Logic (`assign`) | Out of scope for GUI editor |

## Refresh commands

```bash
cd docs/wavedrom-ref
curl -kfsSL -o WaveJSON.md \
  https://raw.githubusercontent.com/wavedrom/schema/master/WaveJSON.md
curl -kfsSL -o README-wavedrom.md \
  https://raw.githubusercontent.com/wavedrom/wavedrom/master/README.md
mkdir -p upstream-tests
for f in signal-step4.json5 signal-arcs.json5 signal-arcs1.json5 reg-vl.json5 assign.json5; do
  curl -kfsSL -o "upstream-tests/$f" \
    "https://raw.githubusercontent.com/wavedrom/wavedrom/trunk/test/$f"
done
```

## License and attribution

WaveDrom source and the upstream fixtures are copyright their respective contributors and distributed under the MIT License. The complete WaveDrom license text is preserved in the generated root `THIRD_PARTY_NOTICES.md` and shipped in `public/licenses/THIRD_PARTY_NOTICES.txt`.

`WaveJSON.md` is derived from the [`wavedrom/schema`](https://github.com/wavedrom/schema) project. That repository is MIT-licensed; its copyright and license text are included in the generated notices through the runtime WaveDrom package and the source link is retained here for provenance.
