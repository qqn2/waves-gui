import { useStore } from '../shared/store';
import { parseCodeToDiagram } from '../codePanel/codeSync';
import { forgetCurrentFileHandle } from './FileOperations';
import {
  sampleParseOptions,
  type SampleFormat,
} from '../sampleLibrary/sampleSource';

export interface SampleLeaf {
  kind: 'sample';
  /** Stable path id, e.g. `amba/apb/write` — mirrors future waves.library layout */
  id: string;
  title: string;
  description: string;
  /** File name under /samples/ (public/) */
  file: string;
  /** Source syntax used when parsing the bundled asset. */
  format?: SampleFormat;
  /** Whether the current editor can parse and render this fixture. */
  support?: 'supported' | 'future';
  /** Why a future-support fixture is retained in the catalog. */
  supportNote?: string;
}

export interface SampleFolder {
  kind: 'folder';
  label: string;
  children: SampleTreeNode[];
}

export type SampleTreeNode = SampleLeaf | SampleFolder;

/** @deprecated Use SampleLeaf — kept for callers that expect the old flat record shape */
export type SampleDiagram = SampleLeaf;

/**
 * Hierarchical sample catalog. Add folders and leaves here as waves.library grows;
 * file paths stay under public/samples/ until assets are reorganized on disk.
 */
export const SAMPLE_LIBRARY: SampleTreeNode[] = [
  {
    kind: 'folder',
    label: 'General',
    children: [
      {
        kind: 'sample',
        id: 'general/clock-reset',
        title: 'Clock and reset',
        description: 'Clock (P, arrow), active-low reset, enable',
        file: 'clock-reset.json',
      },
      {
        kind: 'sample',
        id: 'general/handshake',
        title: 'Handshake',
        description: 'req / gnt / valid / ready',
        file: 'handshake.json',
      },
      {
        kind: 'sample',
        id: 'general/data-bus',
        title: 'Address / data bus',
        description: 'Vector addr and data with write enable',
        file: 'data-bus.json',
      },
      {
        kind: 'sample',
        id: 'general/groups',
        title: 'Grouped signals',
        description: 'Nested WaveDrom groups and spacer row',
        file: 'groups.json',
      },
      {
        kind: 'sample',
        id: 'general/undefined-states',
        title: 'X / Z / U / D',
        description: 'Undefined, high-Z, and meta states',
        file: 'undefined-states.json',
      },
    ],
  },
  {
    kind: 'folder',
    label: 'AMBA',
    children: [
      {
        kind: 'folder',
        label: 'APB',
        children: [
          {
            kind: 'sample',
            id: 'amba/apb/write',
            title: 'Write',
            description: 'PSEL/PENABLE/PREADY setup and access with PADDR/PWDATA (IHI0024E Fig 3-1)',
            file: 'amba-apb-write.json',
          },
          {
            kind: 'sample',
            id: 'amba/apb/read',
            title: 'Read',
            description: 'PSEL/PENABLE/PREADY setup and access with PADDR/PRDATA (IHI0024E Fig 3-4)',
            file: 'amba-apb-read.json',
          },
        ],
      },
      {
        kind: 'folder',
        label: 'AHB',
        children: [
          {
            kind: 'sample',
            id: 'amba/ahb/write',
            title: 'Single write',
            description: 'HTRANS/HADDR/HWRITE/HBURST followed by HWDATA/HREADY/HRESP (IHI0033C)',
            file: 'amba-ahb-write.json',
          },
          {
            kind: 'sample',
            id: 'amba/ahb/transfer-types',
            title: 'Transfer types',
            description: 'HTRANS/HADDR/HREADY with NONSEQ, BUSY, SEQ, INCR, and a wait state',
            file: 'amba-ahb-transfer-types.json',
          },
        ],
      },
      {
        kind: 'folder',
        label: 'AXI',
        children: [
          {
            kind: 'sample',
            id: 'amba/axi/write',
            title: 'Write',
            description: 'AWADDR/AWVALID/AWREADY; WDATA/WSTRB/WLAST; BVALID/BREADY/BRESP',
            file: 'amba-axi-write.json',
          },
          {
            kind: 'sample',
            id: 'amba/axi/read',
            title: 'Read',
            description: 'ARADDR/ARLEN/ARVALID/ARREADY; RDATA/RRESP/RLAST/RVALID/RREADY',
            file: 'amba-axi-read.json',
          },
        ],
      },
    ],
  },
  {
    kind: 'folder',
    label: 'Undulate workflows',
    children: [
      {
        kind: 'sample',
        id: 'undulate/fine-timing',
        title: 'Fine digital timing',
        description: 'Sub-steps, per-cell periods, duty cycles, phase, and slew',
        file: 'undulate-fine-timing.json',
      },
      {
        kind: 'sample',
        id: 'undulate/analogue',
        title: 'Paint and overlay analogue',
        description: 'Step, capacitive, sampled curves, expressions, and overlay groups',
        file: 'undulate-analogue.json',
      },
      {
        kind: 'sample',
        id: 'undulate/annotations',
        title: 'Place annotations',
        description: 'Text, bounded lines, compression, and structured arrows',
        file: 'undulate-annotations.json',
      },
      {
        kind: 'sample',
        id: 'undulate/states-and-style',
        title: 'Extended states and style',
        description: 'Impulse, metastability, expanded nodes, marked edges, and safe styles',
        file: 'undulate-states-style.json',
      },
      {
        kind: 'folder',
        label: 'Upstream compatibility',
        children: [
          {
            kind: 'sample',
            id: 'undulate/ludwig/wavetest',
            title: 'WaveDrom compatibility suite',
            description: 'Upstream wavetest.json: states, groups, buses, timing, and edges',
            file: 'undulate-ludwig-wavetest.json',
            format: 'undulate-json',
          },
          {
            kind: 'sample',
            id: 'undulate/ludwig/wavetest-alt',
            title: 'WaveDrom compatibility suite (alt)',
            description: 'Upstream wavetest_alt.json with extended timing and generated fields',
            file: 'undulate-ludwig-wavetest-alt.json',
            format: 'undulate-json',
          },
          {
            kind: 'sample',
            id: 'undulate/ludwig/wavetest-yaml',
            title: 'WaveDrom compatibility suite (YAML)',
            description: 'Upstream wavetest.yaml mapping syntax and nested groups',
            file: 'undulate-ludwig-wavetest-yaml.yaml',
            format: 'undulate-yaml',
          },
          {
            kind: 'sample',
            id: 'undulate/ludwig/jsonml-syntax',
            title: 'JSONML syntax',
            description: 'Upstream JSONML parser syntax and grouped signal forms',
            file: 'undulate-ludwig-jsonml-syntax.json',
            format: 'undulate-json',
          },
          {
            kind: 'sample',
            id: 'undulate/ludwig/legacy-1',
            title: 'Legacy syntax 1',
            description: 'Upstream legacy JSONML compatibility case',
            file: 'undulate-ludwig-legacy-1.jsonml',
            format: 'undulate-json',
          },
          {
            kind: 'sample',
            id: 'undulate/ludwig/legacy-2',
            title: 'Legacy syntax 2',
            description: 'Upstream legacy JSONML compatibility case',
            file: 'undulate-ludwig-legacy-2.jsonml',
            format: 'undulate-json',
          },
          {
            kind: 'sample',
            id: 'undulate/ludwig/legacy-3',
            title: 'Legacy syntax 3',
            description: 'Upstream legacy JSONML compatibility case',
            file: 'undulate-ludwig-legacy-3.jsonml',
            format: 'undulate-json',
          },
          {
            kind: 'sample',
            id: 'undulate/ludwig/missing-group',
            title: 'Missing group recovery',
            description: 'Upstream JSONML case with incomplete group structure',
            file: 'undulate-ludwig-missing-group.jsonml',
            format: 'undulate-json',
          },
          {
            kind: 'sample',
            id: 'undulate/ludwig/overlay',
            title: 'Overlay tables',
            description: 'Upstream TOML tables with overlays and grouped signals',
            file: 'undulate-ludwig-overlay.toml',
            format: 'undulate-toml',
          },
          {
            kind: 'sample',
            id: 'undulate/ludwig/clip-phase',
            title: 'Phase clipping',
            description: 'Upstream YAML cases for phase clipping and clock edges',
            file: 'undulate-ludwig-clip-phase.yaml',
            format: 'undulate-yaml',
          },
          {
            kind: 'sample',
            id: 'undulate/ludwig/fix-36',
            title: 'Fix 36 regression',
            description: 'Upstream YAML regression for signal and timing parsing',
            file: 'undulate-ludwig-fix-36.yaml',
            format: 'undulate-yaml',
          },
          ...(['0', '1', '2', '3', '4', '5'] as const).map((suffix) => ({
            kind: 'sample' as const,
            id: `undulate/ludwig/title-width-${suffix}`,
            title: `Title width ${suffix}`,
            description: 'Upstream YAML title-width renderer case',
            file: `undulate-ludwig-title-width-${suffix}.yaml`,
            format: 'undulate-yaml' as const,
          })),
          {
            kind: 'sample',
            id: 'undulate/ludwig/adcec',
            title: 'ADCEC period vectors',
            description: 'Upstream case with compact, partial period vectors',
            file: 'undulate-ludwig-adcec.jsonml',
            format: 'undulate-json',
          },
          {
            kind: 'sample',
            id: 'undulate/ludwig/annotation',
            title: 'Generated annotations',
            description: 'Upstream case combining generated periods and legacy edges',
            file: 'undulate-ludwig-annotation.yaml',
            format: 'undulate-yaml',
          },
          {
            kind: 'sample',
            id: 'undulate/ludwig/edge-markers',
            title: 'Edge markers',
            description: 'Upstream case using extended edge markers and HSL styles',
            file: 'undulate-ludwig-edge-markers.yaml',
            format: 'undulate-yaml',
          },
          {
            kind: 'sample',
            id: 'undulate/ludwig/local-config-nodes',
            title: 'Local config nodes',
            description: 'Upstream case with nested layout configuration metadata',
            file: 'undulate-ludwig-local-config-nodes.yaml',
            format: 'undulate-yaml',
          },
          {
            kind: 'sample',
            id: 'undulate/ludwig/term-size',
            title: 'Term size metadata',
            description: 'Upstream case using numeric bus data metadata',
            file: 'undulate-ludwig-term-size.yaml',
            format: 'undulate-yaml',
          },
        ],
      },
    ],
  },
];

/** Flat leaf list — useful for validation tests and bulk operations */
export function collectSampleLeaves(nodes: SampleTreeNode[] = SAMPLE_LIBRARY): SampleLeaf[] {
  const leaves: SampleLeaf[] = [];
  const walk = (list: SampleTreeNode[]) => {
    for (const node of list) {
      if (node.kind === 'sample') leaves.push(node);
      else walk(node.children);
    }
  };
  walk(nodes);
  return leaves;
}

/** @deprecated Prefer SAMPLE_LIBRARY — flat list derived from the tree */
export const SAMPLE_DIAGRAMS: SampleLeaf[] = collectSampleLeaves();

export function findSampleById(sampleId: string): SampleLeaf | undefined {
  return collectSampleLeaves().find((s) => s.id === sampleId);
}

const baseUrl = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');

export function sampleAssetUrl(file: string): string {
  return `${baseUrl}samples/${file}`;
}

export function sampleThumbnailUrl(file: string, theme: 'light' | 'dark'): string {
  return `${baseUrl}samples/previews/${file.replace(/\.[^.]+$/i, `.${theme}.svg`)}`;
}

function confirmDiscardIfDirty(): boolean {
  const { view } = useStore.getState();
  if (!view.isDirty && view.sourceDraftDirty !== true) return true;
  return window.confirm('Discard unsaved changes and load the sample?');
}

export async function loadSampleDiagram(sampleId: string): Promise<boolean> {
  const sample = findSampleById(sampleId);
  if (!sample) {
    window.alert(`Unknown sample: ${sampleId}`);
    return false;
  }
  if (!confirmDiscardIfDirty()) return false;

  try {
    const res = await fetch(sampleAssetUrl(sample.file));
    if (!res.ok) {
      window.alert(`Could not load sample (${res.status})`);
      return false;
    }
    const source = await res.text();
    const parsed = parseCodeToDiagram(source, sampleParseOptions(sample.format));
    if (parsed.ok === false) {
      window.alert(parsed.error);
      return false;
    }
    useStore.getState().loadDiagram(parsed.diagram);
    useStore.getState().markClean(sample.file);
    forgetCurrentFileHandle();
    return true;
  } catch {
    window.alert('Could not load sample diagram');
    return false;
  }
}

export interface LoadableSampleAsset {
  id: string;
  file: string;
  assetUrl: string;
  format?: SampleFormat;
}

export async function loadSampleDiagramAsset(sample: LoadableSampleAsset): Promise<boolean> {
  if (!confirmDiscardIfDirty()) return false;
  try {
    const res = await fetch(sample.assetUrl);
    if (!res.ok) {
      window.alert(`Could not load sample (${res.status})`);
      return false;
    }
    const source = await res.text();
    const parsed = parseCodeToDiagram(source, sampleParseOptions(sample.format));
    if (parsed.ok === false) {
      window.alert(parsed.error);
      return false;
    }
    useStore.getState().loadDiagram(parsed.diagram);
    useStore.getState().markClean(sample.file);
    forgetCurrentFileHandle();
    return true;
  } catch {
    window.alert(`Could not load sample: ${sample.id}`);
    return false;
  }
}
