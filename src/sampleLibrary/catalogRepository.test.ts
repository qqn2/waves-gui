import { describe, expect, it, vi } from 'vitest';
import { CatalogRepository } from './catalogRepository';
import { CATALOG_SHARD_IDS, type CatalogIndexV1, type CatalogShardV1 } from './catalogTypes';

function indexFixture(): CatalogIndexV1 {
  return {
    schemaVersion: 1,
    catalogVersion: 'v1',
    generatedFrom: 'docs/catalog.md',
    curriculumCount: 1,
    entryCount: 1,
    assetEntryCount: 1,
    shardCount: 13,
    aliases: {
      'fundamentals/legacy': 'fundamentals/renamed',
      'fundamentals/older': 'fundamentals/legacy',
    },
    shards: CATALOG_SHARD_IDS.map((id) => ({
      id,
      label: id,
      path: `catalog/${id}.json`,
      sourceNumberRange: id === 'fundamentals' ? { start: 1, end: 32 } : { start: 33, end: 832 },
      curriculumCount: id === 'fundamentals' ? 1 : 0,
      entryCount: id === 'fundamentals' ? 1 : 0,
      assetEntryCount: id === 'fundamentals' ? 1 : 0,
    })),
  };
}

function shardFixture(): CatalogShardV1 {
  return {
    schemaVersion: 1,
    catalogVersion: 'v1',
    shard: indexFixture().shards[0],
    entries: [{
      id: 'fundamentals/renamed',
      sourceNumber: 1,
      slug: 'renamed',
      shardId: 'fundamentals',
      title: 'Renamed',
      description: 'A sample.',
      tier: 'essential',
      contentStatus: 'draft',
      owner: null,
      lastReviewed: null,
      protocols: [],
      concepts: [],
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
        title: 'Renamed',
        body: ['Source number 1'],
      },
      asset: {
        path: 'renamed.json',
        format: 'wavedrom-json',
        previewVersion: 'v1',
      },
    }],
  };
}

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('CatalogRepository', () => {
  it('loads the index lazily, caches concurrent calls, and uses BASE_URL-safe paths', async () => {
    const fetchMock = vi.fn(async () => response(indexFixture()));
    const repository = new CatalogRepository({ baseUrl: '/waves/', fetch: fetchMock as typeof fetch });

    expect(fetchMock).not.toHaveBeenCalled();
    const [first, second] = await Promise.all([repository.getIndex(), repository.getIndex()]);

    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/waves/samples/catalog.v1.json');
  });

  it('loads and caches only the requested shard', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('catalog.v1.json')) return response(indexFixture());
      if (url.endsWith('fundamentals.json')) return response(shardFixture());
      throw new Error(`Unexpected request: ${url}`);
    });
    const repository = new CatalogRepository({ baseUrl: '/subdir', fetch: fetchMock as typeof fetch });

    await Promise.all([repository.getShard('fundamentals'), repository.getShard('fundamentals')]);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/subdir/samples/catalog.v1.json',
      '/subdir/samples/catalog/fundamentals.json',
    ]);
  });

  it('does not cache failed index or shard requests, allowing retries', async () => {
    let indexAttempts = 0;
    let shardAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('catalog.v1.json')) {
        indexAttempts += 1;
        return indexAttempts === 1 ? response({}, 503) : response(indexFixture());
      }
      shardAttempts += 1;
      return shardAttempts === 1 ? response({}, 503) : response(shardFixture());
    });
    const repository = new CatalogRepository({ baseUrl: '/', fetch: fetchMock as typeof fetch });

    await expect(repository.getIndex()).rejects.toThrow(/503/);
    await expect(repository.getIndex()).resolves.toMatchObject({ catalogVersion: 'v1' });
    await expect(repository.getShard('fundamentals')).rejects.toThrow(/503/);
    await expect(repository.getShard('fundamentals')).resolves.toMatchObject({ shard: { id: 'fundamentals' } });
    expect(indexAttempts).toBe(2);
    expect(shardAttempts).toBe(2);
  });

  it('resolves chained aliases deterministically before finding a sample', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('catalog.v1.json')) return response(indexFixture());
      if (url.endsWith('fundamentals.json')) return response(shardFixture());
      throw new Error(`Unexpected request: ${url}`);
    });
    const repository = new CatalogRepository({ baseUrl: '/waves/', fetch: fetchMock as typeof fetch });

    await expect(repository.resolveId('fundamentals/older')).resolves.toBe('fundamentals/renamed');
    await expect(repository.getSample('fundamentals/older')).resolves.toMatchObject({
      id: 'fundamentals/renamed',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never produces an asset URL for index-only entries', () => {
    const repository = new CatalogRepository({ baseUrl: '/waves/' });
    const draft = shardFixture().entries[0];
    expect(repository.assetUrlFor(draft)).toBe('/waves/samples/renamed.json');
    expect(repository.assetUrlFor({
      ...draft,
      contentStatus: 'index-only',
      asset: undefined,
    })).toBeUndefined();
    expect(repository.assetUrlFor({
      ...draft,
      contentStatus: 'index-only',
    })).toBeUndefined();
  });

  it('derives BASE_URL-safe preview URLs for legacy and nested asset paths', () => {
    const repository = new CatalogRepository({ baseUrl: '/waves/' });
    const legacy = shardFixture().entries[0];
    expect(repository.previewUrlFor(legacy, 'dark'))
      .toBe('/waves/samples/previews/renamed.dark.svg');
    expect(repository.previewUrlFor({
      ...legacy,
      asset: { ...legacy.asset!, path: 'waveforms/clocking-reset/nested.json' },
    }, 'light')).toBe('/waves/samples/previews/waveforms/clocking-reset/nested.light.svg');
    expect(repository.previewUrlFor({
      ...legacy,
      contentStatus: 'index-only',
      asset: undefined,
    }, 'dark')).toBeUndefined();
  });
});
