export const CATALOG_VERSION = 'v1';

export const SHARDS = [
  ['fundamentals', 'Fundamentals', 1, 32],
  ['clocking-reset', 'Clocking and reset', 33, 54],
  ['cdc', 'CDC', 55, 80],
  ['buffering', 'FIFOs and buffering', 81, 100],
  ['amba', 'AMBA', 101, 192],
  ['axi-stream-other-buses', 'AXI-Stream and other buses', 193, 235],
  ['cache-coherency-noc', 'Cache, coherency, and NoC', 236, 310],
  ['memory-ddr', 'SRAM and external memory', 311, 364],
  ['serial-peripherals', 'Serial and peripherals', 365, 515],
  ['pcie-chiplets', 'PCIe and chiplets', 516, 579],
  ['networking-media', 'Networking and media', 580, 647],
  ['power-security-safety', 'Power, security, and safety', 648, 695],
  ['firmware-verification-stress', 'Firmware, verification, and stress', 696, 832],
].map(([id, label, start, end]) => ({ id, label, start, end }));

const sample = (id, title, description, file, options = {}) => ({
  id,
  title,
  description,
  file,
  format: options.format ?? 'wavedrom-json',
  contentKind: options.contentKind ?? 'template',
  shard: options.shard ?? 'fundamentals',
  support: options.support ?? 'supported',
  supportNote: options.supportNote ?? null,
});

const ludwig = (slug, title, description, file, format) =>
  sample(`undulate/ludwig/${slug}`, title, description, file, {
    format,
    contentKind: 'compatibility-fixture',
    shard: 'firmware-verification-stress',
  });

/**
 * Frozen migration map for the 37 Phase 1 published IDs. Keeping this explicit
 * makes ID and asset-path changes reviewable rather than deriving them from UI
 * implementation details in src/shell/samples.ts.
 */
export const PUBLISHED_SAMPLES = [
  sample('general/clock-reset', 'Clock and reset', 'Clock (P, arrow), active-low reset, enable', 'clock-reset.json', { shard: 'clocking-reset' }),
  sample('general/handshake', 'Handshake', 'req / gnt / valid / ready', 'handshake.json'),
  sample('general/data-bus', 'Address / data bus', 'Vector addr and data with write enable', 'data-bus.json'),
  sample('general/groups', 'Grouped signals', 'Nested WaveDrom groups and spacer row', 'groups.json'),
  sample('general/undefined-states', 'X / Z / U / D', 'Undefined, high-Z, and meta states', 'undefined-states.json'),
  sample('amba/apb/write', 'Write', 'PSEL/PENABLE/PREADY setup and access with PADDR/PWDATA (IHI0024E Fig 3-1)', 'amba-apb-write.json', { shard: 'amba' }),
  sample('amba/apb/read', 'Read', 'PSEL/PENABLE/PREADY setup and access with PADDR/PRDATA (IHI0024E Fig 3-4)', 'amba-apb-read.json', { shard: 'amba' }),
  sample('amba/ahb/write', 'Single write', 'HTRANS/HADDR/HWRITE/HBURST followed by HWDATA/HREADY/HRESP (IHI0033C)', 'amba-ahb-write.json', { shard: 'amba' }),
  sample('amba/ahb/transfer-types', 'Transfer types', 'HTRANS/HADDR/HREADY with NONSEQ, BUSY, SEQ, INCR, and a wait state', 'amba-ahb-transfer-types.json', { shard: 'amba' }),
  sample('amba/axi/write', 'Write', 'AWADDR/AWVALID/AWREADY; WDATA/WSTRB/WLAST; BVALID/BREADY/BRESP', 'amba-axi-write.json', { shard: 'amba' }),
  sample('amba/axi/read', 'Read', 'ARADDR/ARLEN/ARVALID/ARREADY; RDATA/RRESP/RLAST/RVALID/RREADY', 'amba-axi-read.json', { shard: 'amba' }),
  sample('undulate/fine-timing', 'Fine digital timing', 'Sub-steps, per-cell periods, duty cycles, phase, and slew', 'undulate-fine-timing.json', { format: 'undulate-json', shard: 'firmware-verification-stress' }),
  sample('undulate/analogue', 'Paint and overlay analogue', 'Step, capacitive, sampled curves, expressions, and overlay groups', 'undulate-analogue.json', { format: 'undulate-json', shard: 'firmware-verification-stress' }),
  sample('undulate/annotations', 'Place annotations', 'Text, bounded lines, compression, and structured arrows', 'undulate-annotations.json', { format: 'undulate-json', shard: 'firmware-verification-stress' }),
  sample('undulate/states-and-style', 'Extended states and style', 'Impulse, metastability, expanded nodes, marked edges, and safe styles', 'undulate-states-style.json', { format: 'undulate-json', shard: 'firmware-verification-stress' }),
  ludwig('wavetest', 'WaveDrom compatibility suite', 'Upstream wavetest.json: states, groups, buses, timing, and edges', 'undulate-ludwig-wavetest.json', 'undulate-json'),
  ludwig('wavetest-alt', 'WaveDrom compatibility suite (alt)', 'Upstream wavetest_alt.json with extended timing and generated fields', 'undulate-ludwig-wavetest-alt.json', 'undulate-json'),
  ludwig('wavetest-yaml', 'WaveDrom compatibility suite (YAML)', 'Upstream wavetest.yaml mapping syntax and nested groups', 'undulate-ludwig-wavetest-yaml.yaml', 'undulate-yaml'),
  ludwig('jsonml-syntax', 'JSONML syntax', 'Upstream JSONML parser syntax and grouped signal forms', 'undulate-ludwig-jsonml-syntax.json', 'undulate-json'),
  ludwig('legacy-1', 'Legacy syntax 1', 'Upstream legacy JSONML compatibility case', 'undulate-ludwig-legacy-1.jsonml', 'undulate-json'),
  ludwig('legacy-2', 'Legacy syntax 2', 'Upstream legacy JSONML compatibility case', 'undulate-ludwig-legacy-2.jsonml', 'undulate-json'),
  ludwig('legacy-3', 'Legacy syntax 3', 'Upstream legacy JSONML compatibility case', 'undulate-ludwig-legacy-3.jsonml', 'undulate-json'),
  ludwig('missing-group', 'Missing group recovery', 'Upstream JSONML case with incomplete group structure', 'undulate-ludwig-missing-group.jsonml', 'undulate-json'),
  ludwig('overlay', 'Overlay tables', 'Upstream TOML tables with overlays and grouped signals', 'undulate-ludwig-overlay.toml', 'undulate-toml'),
  ludwig('clip-phase', 'Phase clipping', 'Upstream YAML cases for phase clipping and clock edges', 'undulate-ludwig-clip-phase.yaml', 'undulate-yaml'),
  ludwig('fix-36', 'Fix 36 regression', 'Upstream YAML regression for signal and timing parsing', 'undulate-ludwig-fix-36.yaml', 'undulate-yaml'),
  ...['0', '1', '2', '3', '4', '5'].map((suffix) =>
    ludwig(`title-width-${suffix}`, `Title width ${suffix}`, 'Upstream YAML title-width renderer case', `undulate-ludwig-title-width-${suffix}.yaml`, 'undulate-yaml')),
  ludwig('adcec', 'ADCEC period vectors', 'Upstream case with compact, partial period vectors', 'undulate-ludwig-adcec.jsonml', 'undulate-json'),
  ludwig('annotation', 'Generated annotations', 'Upstream case combining generated periods and legacy edges', 'undulate-ludwig-annotation.yaml', 'undulate-yaml'),
  ludwig('edge-markers', 'Edge markers', 'Upstream case using extended edge markers and HSL styles', 'undulate-ludwig-edge-markers.yaml', 'undulate-yaml'),
  ludwig('local-config-nodes', 'Local config nodes', 'Upstream case with nested layout configuration metadata', 'undulate-ludwig-local-config-nodes.yaml', 'undulate-yaml'),
  ludwig('term-size', 'Term size metadata', 'Upstream case using numeric bus data metadata', 'undulate-ludwig-term-size.yaml', 'undulate-yaml'),
];
