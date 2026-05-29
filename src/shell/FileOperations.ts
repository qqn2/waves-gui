import { fromWavedromJSON, validateWavedromJSON } from '../wavedromBridge';
import { toWavedromJSON } from '../wavedromBridge';
import type { DiagramState } from '../shared/types';
import { useStore } from '../shared/store';
import { clearDraft } from './soloDesk/localDraft';
import { recordRecentFile } from './soloDesk/recentFiles';

type FilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle>;
};

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export async function openDiagramFile(): Promise<void> {
  const w = window as FilePickerWindow;
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({
        types: [
          {
            description: 'WaveDrom JSON',
            accept: { 'application/json': ['.json', '.wp'] },
          },
        ],
      });
      const file = await handle.getFile();
      const text = await readFileAsText(file);
      const json = JSON.parse(text) as unknown;
      const err = validateWavedromJSON(json);
      if (err) {
        window.alert(err);
        return;
      }
      useStore.getState().loadDiagram(fromWavedromJSON(json as Parameters<typeof fromWavedromJSON>[0]));
      useStore.getState().markClean(handle.name);
      recordRecentFile(handle.name);
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve();
        return;
      }
      try {
        const text = await readFileAsText(file);
        const json = JSON.parse(text) as unknown;
        const err = validateWavedromJSON(json);
        if (err) window.alert(err);
        else {
          useStore.getState().loadDiagram(fromWavedromJSON(json as Parameters<typeof fromWavedromJSON>[0]));
          useStore.getState().markClean(file.name);
          recordRecentFile(file.name);
        }
      } catch {
        window.alert('Could not open file');
      }
      resolve();
    };
    input.click();
  });
}

export async function saveDiagramFile(
  diagram: DiagramState,
  existingName?: string | null,
): Promise<void> {
  const w = window as FilePickerWindow;
  const json = JSON.stringify(toWavedromJSON(diagram), null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: existingName ?? 'diagram.json',
        types: [
          {
            description: 'WaveDrom JSON',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      useStore.getState().markClean(handle.name);
      clearDraft();
      recordRecentFile(handle.name);
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = existingName ?? 'diagram.json';
  a.click();
  URL.revokeObjectURL(a.href);
  useStore.getState().markClean(a.download);
  clearDraft();
  recordRecentFile(a.download);
}

export function newDiagramFile(): void {
  const { view, loadDiagram, diagram } = useStore.getState();
  if (view.isDirty && !window.confirm('Discard unsaved changes?')) return;
  loadDiagram({
    version: 1,
    signals: [],
    config: { ...diagram.config, totalSteps: diagram.config.totalSteps },
    annotations: [],
  });
  clearDraft();
  useStore.setState((s) => {
    s.view.fileName = null;
  });
}
