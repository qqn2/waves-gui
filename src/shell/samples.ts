import type { WdRoot } from '../wavedromBridge/wdTypes';
import { fromWavedromJSON, validateWavedromJSON } from '../wavedromBridge';
import { useStore } from '../shared/store';

export interface SampleLeaf {
  kind: 'sample';
  /** Stable path id, e.g. `amba/apb/write` — mirrors future waves.library layout */
  id: string;
  title: string;
  description: string;
  /** File name under /samples/ (public/) */
  file: string;
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
            description: 'SETUP + ACCESS, no wait (IHI0024E Fig 3-1)',
            file: 'amba-apb-write.json',
          },
          {
            kind: 'sample',
            id: 'amba/apb/read',
            title: 'Read',
            description: 'SETUP + ACCESS, PRDATA (IHI0024E Fig 3-4)',
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
            description: 'NONSEQ address phase + data phase (IHI0033C)',
            file: 'amba-ahb-write.json',
          },
          {
            kind: 'sample',
            id: 'amba/ahb/transfer-types',
            title: 'Transfer types',
            description: 'Fig 3-6 style: NONSEQ, BUSY, SEQ, INCR, wait states',
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
            description: 'AW + W + B channels, AWLEN=0, WLAST=1',
            file: 'amba-axi-write.json',
          },
          {
            kind: 'sample',
            id: 'amba/axi/read',
            title: 'Read',
            description: 'AR + R channels, RLAST=1',
            file: 'amba-axi-read.json',
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

function confirmDiscardIfDirty(): boolean {
  const { view } = useStore.getState();
  if (!view.isDirty) return true;
  return window.confirm('Discard unsaved changes and load the sample?');
}

export async function loadSampleDiagram(sampleId: string): Promise<void> {
  const sample = findSampleById(sampleId);
  if (!sample) {
    window.alert(`Unknown sample: ${sampleId}`);
    return;
  }
  if (!confirmDiscardIfDirty()) return;

  try {
    const res = await fetch(sampleAssetUrl(sample.file));
    if (!res.ok) {
      window.alert(`Could not load sample (${res.status})`);
      return;
    }
    const json = (await res.json()) as unknown;
    const err = validateWavedromJSON(json);
    if (err) {
      window.alert(err);
      return;
    }
    useStore.getState().loadDiagram(fromWavedromJSON(json as WdRoot));
    useStore.getState().markClean(sample.file);
  } catch {
    window.alert('Could not load sample diagram');
  }
}
