import { fromWavedromJSON, validateWavedromJSON } from '../wavedromBridge';
import { toWavedromJSON } from '../wavedromBridge';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import type { DiagramState } from '../shared/types';
import { useStore } from '../shared/store';
import { clearDraft } from './soloDesk/localDraft';
import { recordRecentFile } from './soloDesk/recentFiles';
import { flushPendingCodeToDiagram } from '../codePanel/flushRegistry';

type FilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle>;
};

let retainedFileHandle: FileSystemFileHandle | null = null;

export function forgetCurrentFileHandle(): void {
  retainedFileHandle = null;
}

async function writeDiagramToHandle(
  handle: FileSystemFileHandle,
  blob: Blob,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  useStore.getState().markClean(handle.name);
  clearDraft();
  recordRecentFile(handle.name);
}

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
      retainedFileHandle = handle;
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
          forgetCurrentFileHandle();
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

  if (retainedFileHandle) {
    try {
      await writeDiagramToHandle(retainedFileHandle, blob);
      return;
    } catch {
      // A revoked or unavailable handle falls through to Save As/download.
      forgetCurrentFileHandle();
    }
  }

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
      await writeDiagramToHandle(handle, blob);
      retainedFileHandle = handle;
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
  // A download click is only a request: the browser may block or cancel it.
  // Keep the document dirty and preserve recovery data until a confirmed write.
}

export async function saveCurrentDiagramFile(): Promise<void> {
  flushPendingCodeToDiagram();
  const { diagram, view } = useStore.getState();
  await saveDiagramFile(diagram, view.fileName);
}

export function newDiagramFile(): void {
  const { view, loadDiagram } = useStore.getState();
  if (view.isDirty && !window.confirm('Discard unsaved changes?')) return;
  loadDiagram(createDefaultDiagram());
  forgetCurrentFileHandle();
  clearDraft();
  useStore.setState((s) => {
    s.view.fileName = null;
  });
}
