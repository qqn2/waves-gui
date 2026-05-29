# WaveDrom reference sources (vendored)

Local copies and links for WaveJSON / WaveDrom behavior. Refresh manually when upstream changes.

## Official documentation

| Resource | URL | Local copy |
|----------|-----|------------|
| WaveJSON schema notes | https://github.com/wavedrom/schema/blob/master/WaveJSON.md | `WaveJSON.md` |
| WaveDrom engine README | https://github.com/wavedrom/wavedrom | `README-wavedrom.md` |
| Hitchhiker's tutorial | http://wavedrom.com/tutorial.html | (online only; see checklist) |
| Online editor | http://wavedrom.com/editor.html | — |
| JSON schema repo | https://github.com/wavedrom/schema | — |

## Upstream test fixtures (timing + other)

Downloaded from [wavedrom/wavedrom `test/`](https://github.com/wavedrom/wavedrom/tree/trunk/test) (trunk):

| File | Diagram kind | Use in this project |
|------|----------------|---------------------|
| `signal-step4.json5` | Timing (`signal`) | Future golden import (period/phase) |
| `signal-arcs.json5` | Timing + `edge` + `node` | Future edge/node golden |
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

## License

WaveDrom is FOSS; see upstream [LICENSE](https://github.com/wavedrom/wavedrom/blob/trunk/LICENSE). Vendored text is for engineering reference only.
