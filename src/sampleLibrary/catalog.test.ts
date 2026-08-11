import { describe, expect, it } from 'vitest';
import { categoriesFromIndex, filterSampleLibrary, projectManifestEntry } from './catalog';
import type { CatalogShardDescriptor, SampleManifestEntry } from './catalogTypes';

function entry(overrides: Partial<SampleManifestEntry> = {}): SampleManifestEntry {
  return {
    id: 'fundamentals/handshake',
    sourceNumber: 1,
    slug: 'handshake',
    shardId: 'fundamentals',
    title: 'Handshake',
    description: 'Valid and ready coordination',
    tier: 'essential',
    contentStatus: 'index-only',
    owner: null,
    lastReviewed: null,
    protocols: ['ready-valid'],
    concepts: ['backpressure'],
    waveformFeatures: [],
    prerequisites: [],
    next: [],
    pairWith: [],
    reviewNotes: ['Planned'],
    references: [],
    artifactPrompt: null,
    contentKind: 'lesson',
    tags: ['fundamentals'],
    sourceRecord: { document: 'docs/catalog.md', title: 'Handshake', body: ['Source 1'] },
    ...overrides,
  };
}

describe('template library catalog projection', () => {
  it('projects manifest assets into the current preview row shape', () => {
    const manifest = entry({
      sourceNumber: null,
      sourceRecord: null,
      contentStatus: 'draft',
      asset: { path: 'handshake.json', format: 'wavedrom-json', previewVersion: 'v1' },
    });
    const projected = projectManifestEntry(manifest, {
      assetUrlFor: () => '/waves/samples/handshake.json',
      previewUrlFor: (_entry, theme) => `/waves/samples/previews/handshake.${theme}.svg`,
    });
    expect(projected).toMatchObject({
      assetUrl: '/waves/samples/handshake.json',
      thumbnailUrl: '/waves/samples/previews/handshake.dark.svg',
      thumbnailLightUrl: '/waves/samples/previews/handshake.light.svg',
      source: 'WaveDrom JSON',
    });
  });

  it('shows only reviewed and featured entries by default, with separate opt-ins for drafts and plans', () => {
    const repository = { assetUrlFor: () => undefined, previewUrlFor: () => undefined };
    const entries = [
      projectManifestEntry(entry(), repository),
      projectManifestEntry(entry({
        id: 'fundamentals/draft', slug: 'draft', sourceNumber: 2,
        title: 'Unvalidated handshake', contentStatus: 'draft',
        asset: { path: 'samples/waveforms/fundamentals/draft.json', format: 'wavedrom-json', previewVersion: 'v1' },
      }), repository),
      projectManifestEntry(entry({
        id: 'fundamentals/reviewed', slug: 'reviewed', sourceNumber: 3,
        title: 'Reviewed backpressure', contentStatus: 'reviewed', owner: 'team',
        lastReviewed: '2026-08-09', reviewNotes: ['Reviewed'],
        references: [{ name: 'Spec', edition: '1', section: '2' }],
      }), repository),
      projectManifestEntry(entry({
        id: 'fundamentals/old', slug: 'old', sourceNumber: 4,
        title: 'Deprecated lesson', contentStatus: 'deprecated',
      }), repository),
    ];
    expect(filterSampleLibrary(entries, '', false, false).map(({ id }) => id)).toEqual(['fundamentals/reviewed']);
    expect(filterSampleLibrary(entries, '', true, false).map(({ id }) => id)).toEqual([
      'fundamentals/draft', 'fundamentals/reviewed',
    ]);
    expect(filterSampleLibrary(entries, '', false, true).map(({ id }) => id)).toEqual([
      'fundamentals/handshake', 'fundamentals/reviewed',
    ]);
    expect(filterSampleLibrary(entries, 'ready-valid', true, true)).toHaveLength(3);
  });

  it('creates all category rows directly from index descriptors', () => {
    const descriptor: CatalogShardDescriptor = {
      id: 'fundamentals', label: 'Fundamentals', path: 'catalog/fundamentals.json',
      sourceNumberRange: { start: 1, end: 32 }, curriculumCount: 32, entryCount: 36, assetEntryCount: 4,
    };
    expect(categoriesFromIndex([descriptor])).toEqual([{
      id: 'fundamentals', label: 'Fundamentals', description: '1-32', entryCount: 36,
    }]);
  });
});
