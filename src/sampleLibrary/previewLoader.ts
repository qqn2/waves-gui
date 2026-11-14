import { parseCodeToDiagram } from '../codePanel/codeSync';
import type { DiagramState } from '../shared/types';
import type { SampleLibraryEntry } from './catalog';

export const SAMPLE_PREVIEW_CACHE_LIMIT = 6;
const previewCache = new Map<string, DiagramState>();

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Preview request cancelled', 'AbortError');
}

export function clearSamplePreviewCache(): void {
  previewCache.clear();
}

/** Parse only the selected asset without changing the editor or its history. */
export async function loadSamplePreview(
  entry: SampleLibraryEntry,
  signal?: AbortSignal,
): Promise<DiagramState> {
  throwIfCancelled(signal);
  const key = `${entry.id}:${entry.assetUrl}`;
  const cached = previewCache.get(key);
  if (cached) {
    previewCache.delete(key);
    previewCache.set(key, cached);
    return structuredClone(cached);
  }

  const response = await fetch(entry.assetUrl, { signal });
  throwIfCancelled(signal);
  if (!response.ok) throw new Error(`Could not load preview (${response.status})`);
  const source = await response.text();
  throwIfCancelled(signal);
  const parsed = parseCodeToDiagram(source, { preferUndulate: entry.source === 'Undulate' });
  if (parsed.ok === false) throw new Error(parsed.error);
  previewCache.set(key, parsed.diagram);
  while (previewCache.size > SAMPLE_PREVIEW_CACHE_LIMIT) {
    previewCache.delete(previewCache.keys().next().value!);
  }
  // Callers can safely transform a preview without corrupting later selections.
  return structuredClone(parsed.diagram);
}
