import type { CatalogRepository } from './catalogRepository';
import type {
  CatalogAssetFormat,
  CatalogShardDescriptor,
  SampleManifestEntry,
} from './catalogTypes';

export type SampleSource = 'Undulate' | 'WaveDrom JSON' | 'Planned lesson';

export interface SampleLibraryEntry extends SampleManifestEntry {
  assetUrl?: string;
  thumbnailUrl?: string;
  thumbnailLightUrl?: string;
  previewVersion: string;
  source: SampleSource;
  format?: CatalogAssetFormat;
  support?: 'supported' | 'read-only' | 'future';
  supportNote?: string | null;
}

export interface SampleLibraryCategory {
  id: CatalogShardDescriptor['id'];
  label: string;
  description: string;
  entryCount: number;
}

function sourceFor(entry: SampleManifestEntry): SampleSource {
  if (entry.asset === undefined) return 'Planned lesson';
  return entry.asset.format.startsWith('undulate-') ? 'Undulate' : 'WaveDrom JSON';
}

export function projectManifestEntry(
  entry: SampleManifestEntry,
  repository: Pick<CatalogRepository, 'assetUrlFor' | 'previewUrlFor'>,
): SampleLibraryEntry {
  const assetUrl = repository.assetUrlFor(entry);
  return {
    ...entry,
    assetUrl,
    thumbnailUrl: repository.previewUrlFor(entry, 'dark'),
    thumbnailLightUrl: repository.previewUrlFor(entry, 'light'),
    previewVersion: entry.asset?.previewVersion ?? 'planned',
    source: sourceFor(entry),
    format: entry.asset?.format,
    support: entry.asset?.support,
    supportNote: entry.asset?.supportNote,
  };
}

export function categoriesFromIndex(
  descriptors: readonly CatalogShardDescriptor[],
): SampleLibraryCategory[] {
  return descriptors.map((descriptor) => ({
    id: descriptor.id,
    label: descriptor.label,
    description: `${descriptor.sourceNumberRange.start}-${descriptor.sourceNumberRange.end}`,
    entryCount: descriptor.entryCount,
  }));
}

export function filterSampleLibrary(
  entries: readonly SampleLibraryEntry[],
  query: string,
  includeDrafts: boolean,
  includePlanned: boolean,
): SampleLibraryEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return entries.filter((entry) => {
    if (entry.contentStatus === 'deprecated') return false;
    if (!includeDrafts && entry.contentStatus === 'draft') return false;
    if (!includePlanned && entry.contentStatus === 'index-only') return false;
    if (!normalizedQuery) return true;
    const haystack = [
      entry.title,
      entry.description,
      entry.source,
      entry.contentStatus,
      ...entry.tags,
      ...entry.protocols,
      ...entry.concepts,
    ].join(' ').toLocaleLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
