import { parseCatalogIndex, parseCatalogShard } from './catalogSchema';
import type {
  CatalogIndexV1,
  CatalogShardId,
  CatalogShardV1,
  SampleManifestEntry,
} from './catalogTypes';

export interface CatalogRepositoryOptions {
  baseUrl?: string;
  indexPath?: string;
  fetch?: typeof fetch;
}

function joinBaseUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${path.replace(/^\/+/, '')}`;
}

async function fetchJson(fetchImpl: typeof fetch, url: string): Promise<unknown> {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Catalog request failed (${response.status}) for ${url}`);
  return response.json() as Promise<unknown>;
}

export class CatalogRepository {
  private readonly baseUrl: string;
  private readonly indexPath: string;
  private readonly sampleRootPath: string;
  private readonly fetchImpl: typeof fetch;
  private indexRequest?: Promise<CatalogIndexV1>;
  private readonly shardRequests = new Map<CatalogShardId, Promise<CatalogShardV1>>();

  constructor(options: CatalogRepositoryOptions = {}) {
    this.baseUrl = options.baseUrl ?? import.meta.env.BASE_URL;
    this.indexPath = options.indexPath ?? 'samples/catalog.v1.json';
    this.sampleRootPath = this.indexPath.slice(0, Math.max(0, this.indexPath.lastIndexOf('/') + 1));
    this.fetchImpl = options.fetch ?? fetch;
  }

  getIndex(): Promise<CatalogIndexV1> {
    if (this.indexRequest === undefined) {
      const request = fetchJson(this.fetchImpl, joinBaseUrl(this.baseUrl, this.indexPath))
        .then(parseCatalogIndex);
      this.indexRequest = request;
      void request.catch(() => {
        if (this.indexRequest === request) this.indexRequest = undefined;
      });
    }
    return this.indexRequest;
  }

  async getShard(shardId: CatalogShardId): Promise<CatalogShardV1> {
    const cached = this.shardRequests.get(shardId);
    if (cached !== undefined) return cached;

    const request = this.getIndex().then(async (index) => {
      const descriptor = index.shards.find((shard) => shard.id === shardId);
      if (descriptor === undefined) throw new Error(`Unknown catalog shard: ${shardId}`);
      const shard = parseCatalogShard(await fetchJson(
        this.fetchImpl,
        joinBaseUrl(this.baseUrl, `${this.sampleRootPath}${descriptor.path}`),
      ));
      if (shard.shard.id !== shardId) {
        throw new Error(`Catalog shard ${shardId} returned data for ${shard.shard.id}`);
      }
      return shard;
    });
    this.shardRequests.set(shardId, request);
    void request.catch(() => {
      if (this.shardRequests.get(shardId) === request) this.shardRequests.delete(shardId);
    });
    return request;
  }

  async resolveId(id: string): Promise<string> {
    const { aliases } = await this.getIndex();
    const visited = new Set<string>();
    let current = id;
    while (aliases[current] !== undefined) {
      if (visited.has(current)) throw new Error(`Catalog alias cycle involving ${id}`);
      visited.add(current);
      current = aliases[current];
    }
    return current;
  }

  async getSample(idOrAlias: string): Promise<SampleManifestEntry | undefined> {
    const index = await this.getIndex();
    const id = await this.resolveId(idOrAlias);
    const canonicalShardId = id.slice(0, id.indexOf('/'));
    const descriptor = index.shards.find((shard) => shard.id === canonicalShardId);
    if (descriptor !== undefined) {
      return (await this.getShard(descriptor.id)).entries.find((entry) => entry.id === id);
    }
    for (const candidate of index.shards) {
      const entry = (await this.getShard(candidate.id)).entries.find((sample) => sample.id === id);
      if (entry !== undefined) return entry;
    }
    return undefined;
  }

  assetUrlFor(sample: SampleManifestEntry): string | undefined {
    if (sample.contentStatus === 'index-only' || sample.asset === undefined) return undefined;
    return joinBaseUrl(this.baseUrl, `${this.sampleRootPath}${sample.asset.path}`);
  }

  previewUrlFor(sample: SampleManifestEntry, theme: 'light' | 'dark'): string | undefined {
    if (sample.contentStatus === 'index-only' || sample.asset === undefined) return undefined;
    const previewPath = sample.asset.path.replace(/\.[^./]+$/i, `.${theme}.svg`);
    return joinBaseUrl(this.baseUrl, `${this.sampleRootPath}previews/${previewPath}`);
  }

  clearCache(): void {
    this.indexRequest = undefined;
    this.shardRequests.clear();
  }
}
