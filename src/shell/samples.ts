import type { WdRoot } from '../wavedromBridge/wdTypes';
import { fromWavedromJSON, validateWavedromJSON } from '../wavedromBridge';
import { useStore } from '../shared/store';

export interface SampleDiagram {
  id: string;
  title: string;
  description: string;
  /** File name under /samples/ (public/) */
  file: string;
}

/** Bundled examples served from public/samples/ */
export const SAMPLE_DIAGRAMS: SampleDiagram[] = [
  {
    id: 'clock-reset',
    title: 'Clock and reset',
    description: 'Clock (p), active-low reset, enable',
    file: 'clock-reset.json',
  },
  {
    id: 'handshake',
    title: 'Handshake',
    description: 'req / gnt / valid / ready',
    file: 'handshake.json',
  },
  {
    id: 'data-bus',
    title: 'Address / data bus',
    description: 'Vector addr and data with write enable',
    file: 'data-bus.json',
  },
  {
    id: 'groups',
    title: 'Grouped signals',
    description: 'Nested WaveDrom groups and spacer row',
    file: 'groups.json',
  },
  {
    id: 'undefined-states',
    title: 'X / Z / U / D',
    description: 'Undefined, high-Z, and meta states',
    file: 'undefined-states.json',
  },
];

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
