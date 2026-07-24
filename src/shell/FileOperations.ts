import { fromWavedromJSON, validateWavedromJSON } from '../wavedromBridge';
import { toWavedromJSON } from '../wavedromBridge';
import {
  fromUndulateJSON,
  isUndulateJSON,
  toUndulateJSON,
  validateUndulateJSON,
  type UndulateRoot,
} from '../undulateBridge';
import { scanExtensionContent } from '../shared/annotations';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import type { DiagramSourceFormat, DiagramState } from '../shared/types';
import { useStore } from '../shared/store';
import { clearDraft } from './soloDesk/localDraft';
import { recordRecentFile } from './soloDesk/recentFiles';
import { flushPendingCodeToDiagram } from '../codePanel/flushRegistry';
import { vcdToWavedromJSON } from '../importers/vcd';

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
let retainedFileFormat: Extract<
  DiagramSourceFormat,
  'wavedrom-json' | 'undulate-json'
> | null = null;

export function forgetCurrentFileHandle(): void {
  retainedFileHandle = null;
  retainedFileFormat = null;
}

type JSONFileFormat = NonNullable<typeof retainedFileFormat>;

function detectJSONFormat(value: unknown): JSONFileFormat {
  return isUndulateJSON(value)
    ? 'undulate-json'
    : 'wavedrom-json';
}

function parseDiagramJSON(value: unknown): {
  diagram: DiagramState;
  format: JSONFileFormat;
} | { error: string } {
  const format = detectJSONFormat(value);
  const error =
    format === 'undulate-json'
      ? validateUndulateJSON(value)
      : validateWavedromJSON(value);
  if (error) return { error };
  return {
    diagram:
      format === 'undulate-json'
        ? fromUndulateJSON(value as UndulateRoot)
        : fromWavedromJSON(value as Parameters<typeof fromWavedromJSON>[0]),
    format,
  };
}

function parseDiagramFile(file: File, text: string): {
  diagram: DiagramState;
  format: JSONFileFormat;
} | { error: string } {
  if (file.name.toLowerCase().endsWith('.vcd')) {
    const root = vcdToWavedromJSON(text);
    const error = validateWavedromJSON(root);
    if (error) return { error };
    return {
      diagram: fromWavedromJSON(root),
      format: 'wavedrom-json',
    };
  }
  return parseDiagramJSON(JSON.parse(text) as unknown);
}

function saveFormatForDiagram(diagram: DiagramState): JSONFileFormat {
  if (scanExtensionContent(diagram).hasExtensions) return 'undulate-json';
  if (retainedFileFormat) return retainedFileFormat;
  return diagram.compatibility?.sourceFormat === 'undulate-json'
    ? 'undulate-json'
    : 'wavedrom-json';
}

function diagramBlob(diagram: DiagramState, format: JSONFileFormat): Blob {
  const root =
    format === 'undulate-json'
      ? toUndulateJSON(diagram)
      : toWavedromJSON(diagram);
  return new Blob(
    [JSON.stringify(root, null, 2)],
    { type: 'application/json;charset=utf-8' },
  );
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
            description: 'Waveform files',
            accept: { 'application/json': ['.json', '.wp'], 'text/plain': ['.vcd'] },
          },
        ],
      });
      const file = await handle.getFile();
      const text = await readFileAsText(file);
      const parsed = parseDiagramFile(file, text);
      if ('error' in parsed) {
        window.alert(parsed.error);
        return;
      }
      useStore.getState().loadDiagram(parsed.diagram);
      useStore.getState().markClean(handle.name);
      retainedFileHandle = handle;
      retainedFileFormat = parsed.format;
      recordRecentFile(handle.name);
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.wp,.vcd,application/json,text/plain';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve();
        return;
      }
      try {
        const text = await readFileAsText(file);
        const parsed = parseDiagramFile(file, text);
        if ('error' in parsed) window.alert(parsed.error);
        else {
          useStore.getState().loadDiagram(parsed.diagram);
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
  const format = saveFormatForDiagram(diagram);
  const blob = diagramBlob(diagram, format);

  if (retainedFileHandle) {
    try {
      await writeDiagramToHandle(retainedFileHandle, blob);
      retainedFileFormat = format;
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
            description: 'Waveform JSON',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      await writeDiagramToHandle(handle, blob);
      retainedFileHandle = handle;
      retainedFileFormat = format;
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
