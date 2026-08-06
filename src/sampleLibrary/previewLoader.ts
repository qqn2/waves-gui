import { parseCodeToDiagram } from '../codePanel/codeSync';
import type { DiagramState } from '../shared/types';
import type { SampleLibraryEntry } from './catalog';

export const SAMPLE_PREVIEW_CACHE_LIMIT = 6;

const previewCache = new Map<string, DiagramState>();

function cacheKey(entry: SampleLibraryEntry): string {
  return `${entry.id}:${entry.previewVersion}`;
}

function readCachedPreview(key: string): DiagramState | null {
  const cached = previewCache.get(key);
  if (!cached) return null;
  previewCache.delete(key);
  previewCache.set(key, cached);
  return cached;
}

function cachePreview(key: string, diagram: DiagramState): void {
  previewCache.set(key, diagram);
  while (previewCache.size > SAMPLE_PREVIEW_CACHE_LIMIT) {
    const oldestKey = previewCache.keys().next().value;
    if (!oldestKey) return;
    previewCache.delete(oldestKey);
  }
}

function cancellationError(): Error {
  const error = new Error('Preview request cancelled');
  error.name = 'AbortError';
  return error;
}

export function clearSamplePreviewCache(): void {
  previewCache.clear();
}

export async function loadSamplePreview(
  entry: SampleLibraryEntry,
  signal?: AbortSignal,
): Promise<DiagramState> {
  if (signal?.aborted) throw cancellationError();
  const key = cacheKey(entry);
  const cached = readCachedPreview(key);
  if (cached) return cached;

  const response = await fetch(entry.assetUrl, { signal });
  if (!response.ok) {
    throw new Error(`Could not load preview (${response.status})`);
  }
  const source = await response.text();
  if (signal?.aborted) throw cancellationError();

  const parsed = parseCodeToDiagram(source);
  if (parsed.ok === false) throw new Error(parsed.error);
  cachePreview(key, parsed.diagram);
  return parsed.diagram;
}
