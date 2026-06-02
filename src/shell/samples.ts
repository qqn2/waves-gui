import type { WdRoot } from '../wavedromBridge/wdTypes';
import { fromWavedromJSON, validateWavedromJSON } from '../wavedromBridge';
import { useStore } from '../shared/store';

export type SampleCategory = 'general' | 'amba';

export interface SampleDiagram {
  id: string;
  title: string;
  description: string;
  /** File name under /samples/ (public/) */
  file: string;
  category?: SampleCategory;
}

/** Bundled examples served from public/samples/ */
export const SAMPLE_DIAGRAMS: SampleDiagram[] = [
  {
    id: 'clock-reset',
    title: 'Clock and reset',
    description: 'Clock (p), active-low reset, enable',
    file: 'clock-reset.json',
    category: 'general',
  },
  {
    id: 'handshake',
    title: 'Handshake',
    description: 'req / gnt / valid / ready',
    file: 'handshake.json',
    category: 'general',
  },
  {
    id: 'data-bus',
    title: 'Address / data bus',
    description: 'Vector addr and data with write enable',
    file: 'data-bus.json',
    category: 'general',
  },
  {
    id: 'groups',
    title: 'Grouped signals',
    description: 'Nested WaveDrom groups and spacer row',
    file: 'groups.json',
    category: 'general',
  },
  {
    id: 'undefined-states',
    title: 'X / Z / U / D',
    description: 'Undefined, high-Z, and meta states',
    file: 'undefined-states.json',
    category: 'general',
  },
  {
    id: 'amba-apb-write',
    title: 'APB write',
    description: 'SETUP + ACCESS, no wait (IHI0024E Fig 3-1)',
    file: 'amba-apb-write.json',
    category: 'amba',
  },
  {
    id: 'amba-apb-read',
    title: 'APB read',
    description: 'SETUP + ACCESS, PRDATA (IHI0024E Fig 3-4)',
    file: 'amba-apb-read.json',
    category: 'amba',
  },
  {
    id: 'amba-ahb-write',
    title: 'AHB single write',
    description: 'NONSEQ address phase + data phase (IHI0033C)',
    file: 'amba-ahb-write.json',
    category: 'amba',
  },
  {
    id: 'amba-ahb-transfer-types',
    title: 'AHB transfer types',
    description: 'Fig 3-6 style: NONSEQ, BUSY, SEQ, INCR, wait states',
    file: 'amba-ahb-transfer-types.json',
    category: 'amba',
  },
  {
    id: 'amba-axi-write',
    title: 'AXI4 write',
    description: 'AW + W + B channels, AWLEN=0, WLAST=1',
    file: 'amba-axi-write.json',
    category: 'amba',
  },
  {
    id: 'amba-axi-read',
    title: 'AXI4 read',
    description: 'AR + R channels, RLAST=1',
    file: 'amba-axi-read.json',
    category: 'amba',
  },
];

export function samplesByCategory(category: SampleCategory): SampleDiagram[] {
  return SAMPLE_DIAGRAMS.filter((s) => (s.category ?? 'general') === category);
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
  const sample = SAMPLE_DIAGRAMS.find((s) => s.id === sampleId);
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
