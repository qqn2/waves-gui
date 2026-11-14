import { useStore } from '../shared/store';
import { parseCodeToDiagram } from '../codePanel/codeSync';
import { currentFileSession, forgetCurrentFileHandle } from './FileOperations';

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
            title: 'Write without wait states',
            description: 'Hold address and write data through SETUP and ACCESS',
            file: 'amba-apb-write.json',
          },
          {
            kind: 'sample',
            id: 'amba/apb/read',
            title: 'Read without wait states',
            description: 'Read data completes when PSEL, PENABLE, and PREADY are high',
            file: 'amba-apb-read.json',
          },
          {
            kind: 'sample',
            id: 'amba/apb/write-wait',
            title: 'Write with wait states',
            description: 'Hold the request stable while PREADY extends ACCESS',
            file: 'amba-apb-write-wait.json',
          },
          {
            kind: 'sample',
            id: 'amba/apb/read-wait',
            title: 'Read with wait states',
            description: 'Wait for completion before sampling PRDATA',
            file: 'amba-apb-read-wait.json',
          },
          {
            kind: 'sample',
            id: 'amba/apb/back-to-back',
            title: 'Back-to-back transfers',
            description: 'Keep PSEL high while each write gets its own SETUP cycle',
            file: 'amba-apb-back-to-back.json',
          },
          {
            kind: 'sample',
            id: 'amba/apb/error',
            title: 'Error response after a wait',
            description: 'Complete a write with PREADY and report its error through PSLVERR',
            file: 'amba-apb-error.json',
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
            description: 'A NONSEQ address followed by its write data one cycle later',
            file: 'amba-ahb-write.json',
          },
          {
            kind: 'sample',
            id: 'amba/ahb/transfer-types',
            title: 'Read burst: BUSY and wait states',
            description: 'Four INCR read beats showing BUSY versus an HREADY wait',
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
            id: 'amba/axi/read',
            title: 'Single read with backpressure',
            description: 'ARLEN=0, then stable RDATA and RLAST while RREADY waits',
            file: 'amba-axi-read.json',
          },
          {
            kind: 'sample',
            id: 'amba/axi/write',
            title: 'Single write with backpressure',
            description: 'Independent AW, W, and B handshakes with stable stalled payloads',
            file: 'amba-axi-write.json',
          },
        ],
      },
    ],
  },
  {
    kind: 'folder',
    label: 'Undulate tasks',
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
  if (!view.isDirty && view.sourceDraftDirty !== true) return true;
  return window.confirm('Discard unsaved changes and load the sample?');
}

let sampleLoadRequest = 0;

/** Open a fresh sample copy only while the initiating document is unchanged. */
export async function loadSampleDiagram(sampleId: string, signal?: AbortSignal): Promise<boolean> {
  const request = ++sampleLoadRequest;
  if (signal?.aborted) return false;
  const sample = findSampleById(sampleId);
  if (!sample) throw new Error(`Unknown sample: ${sampleId}`);

  const session = currentFileSession();
  let documentChanged = false;
  const unsubscribe = useStore.subscribe((state, previous) => {
    if (
      state.diagram !== previous.diagram
      || state.savedDiagram !== previous.savedDiagram
      || state.view.sourceDraft !== previous.view.sourceDraft
      || state.view.sourceDraftDirty !== previous.view.sourceDraftDirty
      || state.view.fileName !== previous.view.fileName
    ) documentChanged = true;
  });
  const isCurrent = () => !signal?.aborted
    && request === sampleLoadRequest
    && !documentChanged
    && session === currentFileSession();

  try {
    const res = await fetch(sampleAssetUrl(sample.file), { signal });
    if (!isCurrent()) return false;
    if (!res.ok) throw new Error(`Could not load sample (${res.status})`);
    const source = await res.text();
    if (!isCurrent()) return false;
    const parsed = parseCodeToDiagram(source, { preferUndulate: sample.id.startsWith('undulate/') });
    if (parsed.ok === false) throw new Error(parsed.error);
    // Fetching or parsing must never discard the current source draft. Ask only
    // after the replacement is ready, and check again before committing it.
    if (!confirmDiscardIfDirty() || !isCurrent()) return false;
    forgetCurrentFileHandle();
    useStore.getState().loadDiagram(parsed.diagram);
    useStore.getState().markClean(sample.file);
    return true;
  } catch (error) {
    if (!isCurrent() || (error instanceof Error && error.name === 'AbortError')) return false;
    throw error instanceof Error ? error : new Error('Could not load sample diagram');
  } finally {
    unsubscribe();
  }
}
