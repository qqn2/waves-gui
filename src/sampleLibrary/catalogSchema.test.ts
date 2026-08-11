import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CatalogValidationError, parseCatalogIndex, parseCatalogShard } from './catalogSchema';
import {
  CATALOG_SHARD_IDS,
  type CatalogIndexV1,
  type CatalogShardV1,
  type SampleManifestEntry,
} from './catalogTypes';

function indexFixture(): CatalogIndexV1 {
  return {
    schemaVersion: 1,
    catalogVersion: 'v1',
    generatedFrom: 'docs/catalog.md',
    curriculumCount: 0,
    entryCount: 0,
    assetEntryCount: 0,
    shardCount: 13,
    aliases: { 'fundamentals/old-name': 'fundamentals/sample' },
    shards: CATALOG_SHARD_IDS.map((id) => ({
      id,
      label: id,
      path: `catalog/${id}.json`,
      sourceNumberRange: { start: 1, end: 832 },
      curriculumCount: 0,
      entryCount: 0,
      assetEntryCount: 0,
    })),
  };
}

function sampleFixture(overrides: Partial<SampleManifestEntry> = {}): SampleManifestEntry {
  return {
    id: 'fundamentals/sample',
    sourceNumber: 1,
    slug: 'sample',
    shardId: 'fundamentals',
    title: 'Sample',
    description: 'A focused sample.',
    tier: 'essential',
    contentStatus: 'index-only',
    owner: null,
    lastReviewed: null,
    protocols: [],
    concepts: ['handshake'],
    waveformFeatures: [],
    prerequisites: [],
    next: [],
    pairWith: [],
    reviewNotes: [],
    references: [],
    artifactPrompt: null,
    contentKind: 'lesson',
    tags: ['fundamentals'],
    sourceRecord: {
      document: 'docs/catalog.md',
      title: 'Sample',
      body: ['Source number 1'],
    },
    ...overrides,
  };
}

function shardFixture(samples = [sampleFixture()]): CatalogShardV1 {
  return {
    schemaVersion: 1,
    catalogVersion: 'v1',
    shard: {
      id: 'fundamentals',
      label: 'Fundamentals',
      path: 'catalog/fundamentals.json',
      sourceNumberRange: { start: 1, end: 32 },
      curriculumCount: samples.filter((sample) => sample.sourceNumber !== null).length,
      entryCount: samples.length,
      assetEntryCount: samples.filter((sample) => sample.asset !== undefined).length,
    },
    entries: samples,
  };
}

describe('Phase 2 catalog schemas', () => {
  it('validates the generated index and all 13 generated shard documents', () => {
    const samplesRoot = new URL('../../public/samples/', import.meta.url);
    const index = parseCatalogIndex(JSON.parse(readFileSync(new URL('catalog.v1.json', samplesRoot), 'utf8')));
    const shards = index.shards.map((descriptor) => parseCatalogShard(
      JSON.parse(readFileSync(new URL(descriptor.path, samplesRoot), 'utf8')),
    ));
    expect(shards.reduce((sum, shard) => sum + shard.entries.length, 0)).toBe(869);
    expect(shards.reduce(
      (sum, shard) => sum + shard.entries.filter((entry) => entry.sourceNumber !== null).length,
      0,
    )).toBe(832);
  });

  it('accepts the versioned index with exactly the 13 canonical shard descriptors', () => {
    const parsed = parseCatalogIndex(indexFixture());
    expect(parsed.shards.map((shard) => shard.id)).toEqual(CATALOG_SHARD_IDS);
  });

  it.each([
    [{ ...indexFixture(), schemaVersion: 2 }, 'schemaVersion'],
    [{ ...indexFixture(), catalogVersion: 'v2' }, 'catalogVersion'],
    [{ ...indexFixture(), shards: indexFixture().shards.slice(1) }, '13 canonical shards'],
  ])('rejects an unsupported or incomplete index', (value, expectedMessage) => {
    expect(() => parseCatalogIndex(value)).toThrow(expectedMessage);
  });

  it('rejects alias cycles instead of depending on object order', () => {
    const index = indexFixture();
    index.aliases = {
      'fundamentals/one': 'fundamentals/two',
      'fundamentals/two': 'fundamentals/one',
    };
    expect(() => parseCatalogIndex(index)).toThrow(/alias cycle/i);
  });

  it('accepts draft and reviewed entries when their lifecycle metadata is valid', () => {
    const asset = {
      path: 'samples/waveforms/fundamentals/sample.json',
      format: 'wavedrom-json' as const,
      previewVersion: 'v1',
    };
    const parsed = parseCatalogShard(shardFixture([
      sampleFixture({ contentStatus: 'draft', asset }),
      sampleFixture({
        id: 'fundamentals/reviewed',
        slug: 'reviewed',
        sourceNumber: 2,
        contentStatus: 'reviewed',
        owner: 'content-team',
        lastReviewed: '2026-08-09',
        reviewNotes: ['Reviewed against the cited section.'],
        references: [{ name: 'Example specification', edition: '1.0', section: '2.1' }],
        asset: { ...asset, path: 'samples/waveforms/fundamentals/reviewed.json' },
      }),
    ]));
    expect(parsed.entries).toHaveLength(2);
  });

  it.each([
    [sampleFixture({ asset: {
      path: 'samples/waveforms/fundamentals/sample.json',
      format: 'wavedrom-json',
      previewVersion: 'v1',
    } }), 'index-only entries cannot expose'],
    [sampleFixture({ contentStatus: 'draft' }), 'draft entries require'],
    [sampleFixture({
      contentStatus: 'reviewed',
      asset: {
        path: 'samples/waveforms/fundamentals/sample.json',
        format: 'wavedrom-json',
        previewVersion: 'v1',
      },
    }), 'require owner and lastReviewed'],
  ])('rejects lifecycle-invalid samples', (sample, expectedMessage) => {
    expect(() => parseCatalogShard(shardFixture([sample]))).toThrow(expectedMessage);
  });

  it('requires review evidence for reviewed and featured entries', () => {
    expect(() => parseCatalogShard(shardFixture([sampleFixture({
      contentStatus: 'reviewed',
      owner: 'content-team',
      lastReviewed: '2026-08-09',
      asset: {
        path: 'samples/waveforms/fundamentals/sample.json',
        format: 'wavedrom-json',
        previewVersion: 'v1',
      },
    })]))).toThrow(/require references and reviewNotes/i);
  });

  it('allows legacy bundled IDs but requires deterministic IDs for numbered curriculum entries', () => {
    const legacy = sampleFixture({
      id: 'general/clock-reset',
      slug: 'clock-reset',
      shardId: 'clocking-reset',
      sourceNumber: null,
      sourceRecord: null,
    });
    expect(() => parseCatalogShard({
      ...shardFixture([legacy]),
      shard: {
        ...shardFixture([legacy]).shard,
        id: 'clocking-reset',
        path: 'catalog/clocking-reset.json',
        sourceNumberRange: { start: 33, end: 54 },
      },
    })).not.toThrow();

    expect(() => parseCatalogShard(shardFixture([sampleFixture({ id: 'general/sample' })])))
      .toThrow(/curriculum IDs must equal/i);
  });

  it('rejects root-relative asset URL fields from the pre-BASE_URL manifest shape', () => {
    const sample = sampleFixture({
      contentStatus: 'draft',
      asset: {
        path: 'sample.json',
        format: 'wavedrom-json',
        previewVersion: 'v1',
      },
    }) as SampleManifestEntry & { asset: SampleManifestEntry['asset'] & { url: string } };
    sample.asset.url = '/samples/sample.json';
    expect(() => parseCatalogShard(shardFixture([sample]))).toThrow(/deprecated/i);
  });

  it('rejects entries assigned to the wrong shard and duplicate source numbers', () => {
    expect(() => parseCatalogShard(shardFixture([
      sampleFixture(),
      sampleFixture({ id: 'cdc/other', slug: 'other', shardId: 'cdc', sourceNumber: 2 }),
    ]))).toThrow(/belongs to cdc/i);

    expect(() => parseCatalogShard(shardFixture([
      sampleFixture(),
      sampleFixture({ id: 'fundamentals/other', slug: 'other' }),
    ]))).toThrow(/duplicate source number 1/i);
  });

  it('rejects unsafe asset and shard paths', () => {
    const index = indexFixture();
    index.shards[0] = { ...index.shards[0], path: '../catalog.json' };
    expect(() => parseCatalogIndex(index)).toThrow(/safe relative URL path/i);

    expect(() => parseCatalogShard(shardFixture([sampleFixture({
      contentStatus: 'draft',
      asset: { path: 'https://example.test/sample.json', format: 'wavedrom-json', previewVersion: 'v1' },
    })]))).toThrow(/safe relative URL path/i);
  });

  it('reports validation failures with a dedicated error type', () => {
    expect(() => parseCatalogShard({ schemaVersion: 2, catalogVersion: 'v1' })).toThrow(CatalogValidationError);
  });
});
