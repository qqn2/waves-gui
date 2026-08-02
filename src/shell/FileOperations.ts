import { fromWavedromJSON, validateWavedromJSON } from '../wavedromBridge';
import {
  fromUndulateJSON,
  isUndulateJSON,
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
import type { DiagramCodeFormat } from '../codePanel/codeSync';
import {
  json5SyntaxError,
  parseJSON5Source,
} from '../codePanel/json5Source';

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
  'wavedrom-json' | 'undulate-json' | 'undulate-yaml' | 'undulate-toml'
> | null = null;

export function forgetCurrentFileHandle(): void {
  retainedFileHandle = null;
  retainedFileFormat = null;
}

export function switchCurrentDiagramFileFormat(
  format: Extract<
    DiagramSourceFormat,
    'undulate-json' | 'undulate-yaml' | 'undulate-toml'
  >,
): void {
  retainedFileHandle = null;
  retainedFileFormat = format;
  useStore.setState((state) => {
    const name = state.view.fileName;
    if (!name) return;
    const base = name
      .replace(/\.undulate\.(?:json(?:ml)?|ya?ml|toml)$/i, '')
      .replace(/\.(?:json(?:ml)?|wp|ya?ml|toml)$/i, '');
    state.view.fileName =
      format === 'undulate-yaml'
        ? `${base}.undulate.yaml`
        : format === 'undulate-toml'
          ? `${base}.undulate.toml`
          : `${base}.undulate.json`;
  });
}

type DiagramFileFormat = NonNullable<typeof retainedFileFormat>;

function detectJSONFormat(
  value: unknown,
  preferUndulate = false,
): Exclude<DiagramFileFormat, 'undulate-yaml' | 'undulate-toml'> {
  return preferUndulate || isUndulateJSON(value)
    ? 'undulate-json'
    : 'wavedrom-json';
}

function parseDiagramJSON(
  value: unknown,
  sourceText?: string,
  preferUndulate = false,
): {
  diagram: DiagramState;
  format: DiagramFileFormat;
} | { error: string } {
  const format = detectJSONFormat(value, preferUndulate);
  const error =
    format === 'undulate-json'
      ? validateUndulateJSON(value)
      : validateWavedromJSON(value);
  if (error) return { error };
  const diagram =
    format === 'undulate-json'
      ? fromUndulateJSON(value as UndulateRoot)
      : fromWavedromJSON(value as Parameters<typeof fromWavedromJSON>[0]);
  if (sourceText !== undefined) {
    diagram.compatibility = {
      ...diagram.compatibility,
      extensionsEnabled:
        format === 'undulate-json'
        || diagram.compatibility?.extensionsEnabled === true,
      sourceFormat:
        format === 'undulate-json'
          ? 'undulate-json'
          : diagram.compatibility?.sourceFormat,
      sourceText,
    };
  }
  return {
    diagram,
    format,
  };
}

async function parseDiagramFile(
  file: File,
  text: string,
  kind: 'document' | 'vcd',
): Promise<{
  diagram: DiagramState;
  format: DiagramFileFormat;
} | { error: string }> {
  if (kind === 'vcd') {
    const { vcdToWavedromJSON } = await import('../importers/vcd');
    const root = vcdToWavedromJSON(text);
    const error = validateWavedromJSON(root);
    if (error) return { error };
    return {
      diagram: fromWavedromJSON(root),
      format: 'wavedrom-json',
    };
  }
  if (file.name.toLowerCase().endsWith('.vcd')) {
    return { error: 'Use File → Open VCD… to import Value Change Dump files.' };
  }
  if (/\.ya?ml$/i.test(file.name)) {
    try {
      const { parseUndulateYAML } = await import(
        '../undulateBridge/undulateYAML'
      );
      const root = parseUndulateYAML(text);
      const error = validateUndulateJSON(root);
      if (error) return { error };
      const diagram = fromUndulateJSON(root);
      diagram.compatibility = {
        ...diagram.compatibility,
        sourceFormat: 'undulate-yaml',
        sourceText: text,
      };
      return { diagram, format: 'undulate-yaml' };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid Undulate YAML',
      };
    }
  }
  if (/\.toml$/i.test(file.name)) {
    try {
      const { parseUndulateTOML } = await import(
        '../undulateBridge/undulateTOML'
      );
      const root = parseUndulateTOML(text);
      const error = validateUndulateJSON(root);
      if (error) return { error };
      const diagram = fromUndulateJSON(root);
      diagram.compatibility = {
        ...diagram.compatibility,
        sourceFormat: 'undulate-toml',
        sourceText: text,
      };
      return { diagram, format: 'undulate-toml' };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid Undulate TOML',
      };
    }
  }
  try {
    return parseDiagramJSON(
      parseJSON5Source(text),
      text,
      /\.undulate\.json(?:ml)?$/i.test(file.name),
    );
  } catch (error) {
    return { error: json5SyntaxError(error) };
  }
}

function saveFormatForDiagram(diagram: DiagramState): DiagramFileFormat {
  if (retainedFileFormat === 'undulate-yaml') return 'undulate-yaml';
  if (retainedFileFormat === 'undulate-toml') return 'undulate-toml';
  if (diagram.compatibility?.sourceFormat === 'undulate-yaml') {
    return 'undulate-yaml';
  }
  if (diagram.compatibility?.sourceFormat === 'undulate-toml') {
    return 'undulate-toml';
  }
  if (scanExtensionContent(diagram).hasExtensions) return 'undulate-json';
  if (retainedFileFormat) return retainedFileFormat;
  return diagram.compatibility?.sourceFormat === 'undulate-json'
    ? 'undulate-json'
    : 'wavedrom-json';
}

async function diagramBlob(
  diagram: DiagramState,
  format: DiagramFileFormat,
): Promise<Blob> {
  const { diagramToCodeStringForFormat } = await import('../codePanel/codeSync');
  const codeFormat: DiagramCodeFormat =
    format === 'undulate-yaml'
      ? 'undulate-yaml'
      : format === 'undulate-toml'
        ? 'undulate-toml'
      : format === 'undulate-json' ? 'undulate' : 'wavedrom';
  return new Blob(
    [diagramToCodeStringForFormat(diagram, codeFormat)],
    {
      type: format === 'undulate-yaml'
        ? 'application/yaml;charset=utf-8'
        : format === 'undulate-toml'
          ? 'application/toml;charset=utf-8'
        : 'application/json;charset=utf-8',
    },
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

async function openFile(kind: 'document' | 'vcd'): Promise<void> {
  const w = window as FilePickerWindow;
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({
        types: [
          kind === 'vcd' ? {
            description: 'Value Change Dump',
            accept: { 'text/plain': ['.vcd'] },
          } : {
            description: 'Waveform files',
            accept: {
              'application/json': ['.json', '.jsonml', '.wp'],
              'application/yaml': ['.yaml', '.yml'],
              'application/toml': ['.toml'],
            },
          },
        ],
      });
      const file = await handle.getFile();
      const text = await readFileAsText(file);
      const parsed = await parseDiagramFile(file, text, kind);
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
    input.accept = kind === 'vcd'
      ? '.vcd,text/plain'
      : '.json,.jsonml,.wp,.yaml,.yml,.toml,application/json,application/yaml,application/toml';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve();
        return;
      }
      try {
        const text = await readFileAsText(file);
        const parsed = await parseDiagramFile(file, text, kind);
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

export function openDiagramFile(): Promise<void> {
  return openFile('document');
}

export function openVCDFile(): Promise<void> {
  return openFile('vcd');
}

export async function saveDiagramFile(
  diagram: DiagramState,
  existingName?: string | null,
): Promise<void> {
  const w = window as FilePickerWindow;
  const format = saveFormatForDiagram(diagram);
  const blob = await diagramBlob(diagram, format);

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
        suggestedName:
          existingName
          ?? (format === 'undulate-yaml'
            ? 'diagram.undulate.yaml'
            : format === 'undulate-toml'
              ? 'diagram.undulate.toml'
            : 'diagram.json'),
        types: [
          {
            description: 'Waveform document',
            accept: {
              'application/json': ['.json', '.jsonml'],
              'application/yaml': ['.yaml', '.yml'],
              'application/toml': ['.toml'],
            },
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
