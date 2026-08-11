import {
  CATALOG_SCHEMA_VERSION,
  CATALOG_SHARD_IDS,
  CATALOG_VERSION,
  type CatalogAsset,
  type CatalogIndexV1,
  type CatalogReference,
  type CatalogShardDescriptor,
  type CatalogShardId,
  type CatalogShardV1,
  type SampleManifestEntry,
} from './catalogTypes';

const SHARD_IDS = new Set<string>(CATALOG_SHARD_IDS);
const TIERS = new Set(['essential', 'intermediate', 'advanced', 'failure', 'stress']);
const STATUSES = new Set(['index-only', 'draft', 'reviewed', 'featured', 'deprecated']);
const CONTENT_KINDS = new Set(['lesson', 'study', 'fixture', 'stress']);
const ASSET_FORMATS = new Set(['wavedrom-json', 'undulate-json', 'undulate-yaml', 'undulate-toml']);
const SUPPORT_LEVELS = new Set(['supported', 'read-only', 'future']);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_RELATIVE_PATH = /^(?![a-z][a-z\d+.-]*:)(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^?#\\]+$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CatalogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new CatalogValidationError(`${path}: ${message}`);
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'expected an object');
  return value as Record<string, unknown>;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'expected a non-empty string');
  return value;
}

function nullableStringAt(value: unknown, path: string): string | null {
  return value === null ? null : stringAt(value, path);
}

function integerAt(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) fail(path, 'expected a non-negative integer');
  return value as number;
}

function stringArrayAt(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(path, 'expected an array');
  const result = value.map((item, index) => stringAt(item, `${path}[${index}]`));
  if (new Set(result).size !== result.length) fail(path, 'contains duplicates');
  return result;
}

function stringListAt(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(path, 'expected an array');
  return value.map((item, index) => stringAt(item, `${path}[${index}]`));
}

function enumAt<T extends string>(value: unknown, allowed: Set<string>, path: string): T {
  const parsed = stringAt(value, path);
  if (!allowed.has(parsed)) fail(path, `unsupported value ${JSON.stringify(parsed)}`);
  return parsed as T;
}

function shardIdAt(value: unknown, path: string): CatalogShardId {
  return enumAt<CatalogShardId>(value, SHARD_IDS, path);
}

function validateVersion(object: Record<string, unknown>, path: string): void {
  if (object.schemaVersion !== CATALOG_SCHEMA_VERSION) {
    fail(`${path}.schemaVersion`, `unsupported schema version ${JSON.stringify(object.schemaVersion)}`);
  }
  if (object.catalogVersion !== CATALOG_VERSION) {
    fail(`${path}.catalogVersion`, `unsupported catalog version ${JSON.stringify(object.catalogVersion)}`);
  }
}

function safePathAt(value: unknown, path: string): string {
  const parsed = stringAt(value, path);
  if (!SAFE_RELATIVE_PATH.test(parsed)) fail(path, 'must be a safe relative URL path');
  return parsed;
}

function parseDescriptor(value: unknown, path: string): CatalogShardDescriptor {
  const object = objectAt(value, path);
  const range = objectAt(object.sourceNumberRange, `${path}.sourceNumberRange`);
  const start = integerAt(range.start, `${path}.sourceNumberRange.start`);
  const end = integerAt(range.end, `${path}.sourceNumberRange.end`);
  if (start < 1 || end < start) fail(`${path}.sourceNumberRange`, 'must be an ordered positive range');
  return {
    id: shardIdAt(object.id, `${path}.id`),
    label: stringAt(object.label, `${path}.label`),
    path: safePathAt(object.path, `${path}.path`),
    sourceNumberRange: { start, end },
    curriculumCount: integerAt(object.curriculumCount, `${path}.curriculumCount`),
    entryCount: integerAt(object.entryCount, `${path}.entryCount`),
    assetEntryCount: integerAt(object.assetEntryCount, `${path}.assetEntryCount`),
  };
}

function parseAsset(value: unknown, path: string): CatalogAsset {
  const object = objectAt(value, path);
  const asset: CatalogAsset = {
    path: safePathAt(object.path, `${path}.path`),
    format: enumAt(object.format, ASSET_FORMATS, `${path}.format`),
    previewVersion: stringAt(object.previewVersion, `${path}.previewVersion`),
  };
  if (object.url !== undefined || object.previews !== undefined) {
    fail(path, 'url and previews are deprecated; use BASE_URL-safe asset.path');
  }
  if (object.support !== undefined) asset.support = enumAt(object.support, SUPPORT_LEVELS, `${path}.support`);
  if (object.supportNote !== undefined) asset.supportNote = nullableStringAt(object.supportNote, `${path}.supportNote`);
  return asset;
}

function parseReference(value: unknown, path: string): CatalogReference {
  const object = objectAt(value, path);
  const reference: CatalogReference = {
    name: stringAt(object.name, `${path}.name`),
    edition: nullableStringAt(object.edition, `${path}.edition`),
    section: nullableStringAt(object.section, `${path}.section`),
  };
  if (object.url !== undefined) reference.url = stringAt(object.url, `${path}.url`);
  return reference;
}

export function parseSampleManifestEntry(value: unknown, path = 'sample'): SampleManifestEntry {
  const object = objectAt(value, path);
  const shardId = shardIdAt(object.shardId, `${path}.shardId`);
  const slug = stringAt(object.slug, `${path}.slug`);
  if (!SLUG_PATTERN.test(slug)) fail(`${path}.slug`, 'must be a lowercase kebab-case slug');
  const id = stringAt(object.id, `${path}.id`);
  if (!ID_PATTERN.test(id)) fail(`${path}.id`, 'must be a lowercase slash-separated ID');

  const sourceNumber = object.sourceNumber;
  if (sourceNumber !== null && (!Number.isInteger(sourceNumber) || (sourceNumber as number) <= 0)) {
    fail(`${path}.sourceNumber`, 'expected a positive integer or null');
  }
  if (sourceNumber !== null && id !== `${shardId}/${slug}`) {
    fail(`${path}.id`, `curriculum IDs must equal ${JSON.stringify(`${shardId}/${slug}`)}`);
  }
  const contentStatus = enumAt<SampleManifestEntry['contentStatus']>(object.contentStatus, STATUSES, `${path}.contentStatus`);
  const owner = nullableStringAt(object.owner, `${path}.owner`);
  const lastReviewed = nullableStringAt(object.lastReviewed, `${path}.lastReviewed`);
  if (lastReviewed !== null && !ISO_DATE.test(lastReviewed)) fail(`${path}.lastReviewed`, 'must use YYYY-MM-DD');

  const asset = object.asset === undefined ? undefined : parseAsset(object.asset, `${path}.asset`);
  if (contentStatus === 'index-only' && asset !== undefined) fail(`${path}.asset`, 'index-only entries cannot expose waveform assets');
  if (contentStatus === 'draft' && asset === undefined) fail(`${path}.asset`, 'draft entries require a waveform asset');
  if ((contentStatus === 'reviewed' || contentStatus === 'featured') && asset === undefined) {
    fail(`${path}.asset`, `${contentStatus} entries require a waveform asset`);
  }
  if ((contentStatus === 'reviewed' || contentStatus === 'featured') && (owner === null || lastReviewed === null)) {
    fail(path, `${contentStatus} entries require owner and lastReviewed`);
  }
  if ((contentStatus === 'index-only' || contentStatus === 'draft') && lastReviewed !== null) {
    fail(`${path}.lastReviewed`, `${contentStatus} entries have not completed review`);
  }

  if (!Array.isArray(object.references)) fail(`${path}.references`, 'expected an array');
  const entry: SampleManifestEntry = {
    id,
    sourceNumber: sourceNumber as number | null,
    slug,
    shardId,
    title: stringAt(object.title, `${path}.title`),
    description: stringAt(object.description, `${path}.description`),
    tier: enumAt(object.tier, TIERS, `${path}.tier`),
    contentStatus,
    owner,
    lastReviewed,
    protocols: stringArrayAt(object.protocols, `${path}.protocols`),
    concepts: stringArrayAt(object.concepts, `${path}.concepts`),
    waveformFeatures: stringArrayAt(object.waveformFeatures, `${path}.waveformFeatures`),
    prerequisites: stringArrayAt(object.prerequisites, `${path}.prerequisites`),
    next: stringArrayAt(object.next, `${path}.next`),
    pairWith: stringArrayAt(object.pairWith, `${path}.pairWith`),
    reviewNotes: stringArrayAt(object.reviewNotes, `${path}.reviewNotes`),
    references: object.references.map((item, index) => parseReference(item, `${path}.references[${index}]`)),
    artifactPrompt: nullableStringAt(object.artifactPrompt, `${path}.artifactPrompt`),
    contentKind: enumAt(object.contentKind, CONTENT_KINDS, `${path}.contentKind`),
    tags: stringArrayAt(object.tags, `${path}.tags`),
    sourceRecord: null,
  };
  if (asset !== undefined) entry.asset = asset;
  if (object.subcategoryIds !== undefined) entry.subcategoryIds = stringArrayAt(object.subcategoryIds, `${path}.subcategoryIds`);
  if (object.sourceRecord === null) {
    if (sourceNumber !== null) fail(`${path}.sourceRecord`, 'curriculum entries require a source record');
  } else {
    if (sourceNumber === null) fail(`${path}.sourceRecord`, 'bundled entries must use null');
    const source = objectAt(object.sourceRecord, `${path}.sourceRecord`);
    entry.sourceRecord = {
      document: safePathAt(source.document, `${path}.sourceRecord.document`),
      title: stringAt(source.title, `${path}.sourceRecord.title`),
      body: stringListAt(source.body, `${path}.sourceRecord.body`),
    };
  }
  if ((contentStatus === 'reviewed' || contentStatus === 'featured')
      && (entry.references.length === 0 || entry.reviewNotes.length === 0)) {
    fail(path, `${contentStatus} entries require references and reviewNotes`);
  }
  return entry;
}

function parseAliases(value: unknown): Record<string, string> {
  const object = objectAt(value, 'catalog index.aliases');
  const aliases: Record<string, string> = {};
  for (const [from, rawTarget] of Object.entries(object)) {
    if (!ID_PATTERN.test(from)) fail(`catalog index.aliases.${from}`, 'alias must be a valid ID');
    const target = stringAt(rawTarget, `catalog index.aliases.${from}`);
    if (!ID_PATTERN.test(target)) fail(`catalog index.aliases.${from}`, 'target must be a valid ID');
    aliases[from] = target;
  }
  for (const from of Object.keys(aliases)) {
    const visited = new Set<string>();
    let current = from;
    while (aliases[current] !== undefined) {
      if (visited.has(current)) fail(`catalog index.aliases.${from}`, 'alias cycle detected');
      visited.add(current);
      current = aliases[current];
    }
  }
  return aliases;
}

export function parseCatalogIndex(value: unknown): CatalogIndexV1 {
  const object = objectAt(value, 'catalog index');
  validateVersion(object, 'catalog index');
  if (!Array.isArray(object.shards)) fail('catalog index.shards', 'expected an array');
  const shards = object.shards.map((item, index) => parseDescriptor(item, `catalog index.shards[${index}]`));
  const ids = shards.map((shard) => shard.id);
  if (ids.length !== CATALOG_SHARD_IDS.length || new Set(ids).size !== CATALOG_SHARD_IDS.length
      || CATALOG_SHARD_IDS.some((id) => !ids.includes(id))) {
    fail('catalog index.shards', 'must contain each of the 13 canonical shards exactly once');
  }
  const shardCount = integerAt(object.shardCount, 'catalog index.shardCount');
  if (shardCount !== CATALOG_SHARD_IDS.length) fail('catalog index.shardCount', 'must be 13');
  const curriculumCount = integerAt(object.curriculumCount, 'catalog index.curriculumCount');
  const entryCount = integerAt(object.entryCount, 'catalog index.entryCount');
  const assetEntryCount = integerAt(object.assetEntryCount, 'catalog index.assetEntryCount');
  if (shards.reduce((sum, shard) => sum + shard.curriculumCount, 0) !== curriculumCount) fail('catalog index.curriculumCount', 'does not match shard totals');
  if (shards.reduce((sum, shard) => sum + shard.entryCount, 0) !== entryCount) fail('catalog index.entryCount', 'does not match shard totals');
  if (shards.reduce((sum, shard) => sum + shard.assetEntryCount, 0) !== assetEntryCount) fail('catalog index.assetEntryCount', 'does not match shard totals');
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    catalogVersion: CATALOG_VERSION,
    generatedFrom: safePathAt(object.generatedFrom, 'catalog index.generatedFrom'),
    curriculumCount,
    entryCount,
    assetEntryCount,
    shardCount: CATALOG_SHARD_IDS.length,
    aliases: parseAliases(object.aliases),
    shards,
  };
}

export function parseCatalogShard(value: unknown): CatalogShardV1 {
  const object = objectAt(value, 'catalog shard');
  validateVersion(object, 'catalog shard');
  const shard = parseDescriptor(object.shard, 'catalog shard.shard');
  if (!Array.isArray(object.entries)) fail('catalog shard.entries', 'expected an array');
  const entries = object.entries.map((item, index) => parseSampleManifestEntry(item, `catalog shard.entries[${index}]`));
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const sourceNumbers = new Set<number>();
  for (const entry of entries) {
    if (entry.shardId !== shard.id) fail(`catalog shard entry ${entry.id}`, `belongs to ${entry.shardId}, not ${shard.id}`);
    if (ids.has(entry.id)) fail('catalog shard.entries', `duplicate sample ID ${entry.id}`);
    if (slugs.has(entry.slug)) fail('catalog shard.entries', `duplicate slug ${entry.slug}`);
    ids.add(entry.id);
    slugs.add(entry.slug);
    if (entry.sourceNumber !== null) {
      if (sourceNumbers.has(entry.sourceNumber)) fail('catalog shard.entries', `duplicate source number ${entry.sourceNumber}`);
      if (entry.sourceNumber < shard.sourceNumberRange.start || entry.sourceNumber > shard.sourceNumberRange.end) {
        fail(`catalog shard entry ${entry.id}.sourceNumber`, 'is outside the shard range');
      }
      sourceNumbers.add(entry.sourceNumber);
    }
  }
  const curriculumCount = entries.filter((entry) => entry.sourceNumber !== null).length;
  const assetEntryCount = entries.filter((entry) => entry.asset !== undefined).length;
  if (shard.entryCount !== entries.length) fail('catalog shard.shard.entryCount', 'does not match entries');
  if (shard.curriculumCount !== curriculumCount) fail('catalog shard.shard.curriculumCount', 'does not match entries');
  if (shard.assetEntryCount !== assetEntryCount) fail('catalog shard.shard.assetEntryCount', 'does not match entries');
  return { schemaVersion: CATALOG_SCHEMA_VERSION, catalogVersion: CATALOG_VERSION, shard, entries };
}
