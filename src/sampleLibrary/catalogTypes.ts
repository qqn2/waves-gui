export const CATALOG_SCHEMA_VERSION = 1 as const;
export const CATALOG_VERSION = 'v1' as const;

export const CATALOG_SHARD_IDS = [
  'fundamentals',
  'clocking-reset',
  'cdc',
  'buffering',
  'amba',
  'axi-stream-other-buses',
  'cache-coherency-noc',
  'memory-ddr',
  'serial-peripherals',
  'pcie-chiplets',
  'networking-media',
  'power-security-safety',
  'firmware-verification-stress',
] as const;

export type CatalogShardId = (typeof CATALOG_SHARD_IDS)[number];

export type CatalogTier =
  | 'essential'
  | 'intermediate'
  | 'advanced'
  | 'failure'
  | 'stress';

export type ContentStatus =
  | 'index-only'
  | 'draft'
  | 'reviewed'
  | 'featured'
  | 'deprecated';

export type ContentKind =
  | 'lesson'
  | 'study'
  | 'fixture'
  | 'stress';

export type CatalogAssetFormat =
  | 'wavedrom-json'
  | 'undulate-json'
  | 'undulate-yaml'
  | 'undulate-toml';

export interface CatalogAsset {
  path: string;
  format: CatalogAssetFormat;
  previewVersion: string;
  support?: 'supported' | 'read-only' | 'future';
  supportNote?: string | null;
}

export interface CatalogReference {
  name: string;
  edition: string | null;
  section: string | null;
  url?: string;
}

export interface SampleManifestEntry {
  id: string;
  sourceNumber: number | null;
  slug: string;
  shardId: CatalogShardId;
  title: string;
  description: string;
  tier: CatalogTier;
  contentStatus: ContentStatus;
  owner: string | null;
  lastReviewed: string | null;
  protocols: string[];
  concepts: string[];
  waveformFeatures: string[];
  prerequisites: string[];
  next: string[];
  pairWith: string[];
  reviewNotes: string[];
  references: CatalogReference[];
  artifactPrompt: string | null;
  contentKind: ContentKind;
  asset?: CatalogAsset;
  subcategoryIds?: string[];
  tags: string[];
  sourceRecord: {
    document: string;
    title: string;
    body: string[];
  } | null;
}

export interface CatalogShardDescriptor {
  id: CatalogShardId;
  label: string;
  path: string;
  sourceNumberRange: {
    start: number;
    end: number;
  };
  curriculumCount: number;
  entryCount: number;
  assetEntryCount: number;
}

export interface CatalogIndexV1 {
  schemaVersion: typeof CATALOG_SCHEMA_VERSION;
  catalogVersion: typeof CATALOG_VERSION;
  generatedFrom: string;
  curriculumCount: number;
  entryCount: number;
  assetEntryCount: number;
  shardCount: typeof CATALOG_SHARD_IDS.length;
  shards: CatalogShardDescriptor[];
  aliases: Record<string, string>;
}

export interface CatalogShardV1 {
  schemaVersion: typeof CATALOG_SCHEMA_VERSION;
  catalogVersion: typeof CATALOG_VERSION;
  shard: CatalogShardDescriptor;
  entries: SampleManifestEntry[];
}
