import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateSampleCatalog } from '../../scripts/check-sample-catalog.mjs';

const SHARDS: ReadonlyArray<readonly [string, number, number]> = [
  ['fundamentals', 1, 32],
  ['clocking-reset', 33, 54],
  ['cdc', 55, 80],
  ['buffering', 81, 100],
  ['amba', 101, 192],
  ['axi-stream-other-buses', 193, 235],
  ['cache-coherency-noc', 236, 310],
  ['memory-ddr', 311, 364],
  ['serial-peripherals', 365, 515],
  ['pcie-chiplets', 516, 579],
  ['networking-media', 580, 647],
  ['power-security-safety', 648, 695],
  ['firmware-verification-stress', 696, 832],
];

interface FixtureEntry {
  id: string;
  slug: string;
  sourceNumber: number;
  title: string;
  description: string;
  shardId: string;
  tier: string;
  contentStatus: string;
  contentKind: string;
  owner: null;
  lastReviewed: null;
  waveformFeatures: string[];
  protocols: string[];
  concepts: string[];
  prerequisites: string[];
  next: string[];
  pairWith: string[];
  references: unknown[];
  artifactPrompt: null;
  reviewNotes: string[];
  tags: string[];
  sourceRecord: { document: string; title: string; body: string[] };
}

interface FixtureDescriptor {
  id: string;
  label: string;
  path: string;
  sourceNumberRange: { start: number; end: number };
  curriculumCount: number;
  entryCount: number;
  assetEntryCount: number;
}

interface FixtureShardDocument {
  descriptor: FixtureDescriptor;
  document: {
    schemaVersion: number;
    catalogVersion: string;
    shard: FixtureDescriptor;
    entries: FixtureEntry[];
  };
}

interface FixtureIndex {
  schemaVersion: number;
  catalogVersion: string;
  generatedFrom: string;
  curriculumCount: number;
  entryCount: number;
  assetEntryCount: number;
  shardCount: number;
  shards: FixtureDescriptor[];
  aliases?: Record<string, string>;
}

interface FixtureState {
  index: FixtureIndex;
  shardDocuments: FixtureShardDocument[];
}

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function curriculumEntry(shardId: string, sourceNumber: number): FixtureEntry {
  const slug = `sample-${sourceNumber}`;
  return {
    id: `${shardId}/${slug}`,
    slug,
    sourceNumber,
    title: `Sample ${sourceNumber}`,
    description: `Fixture entry ${sourceNumber}`,
    shardId,
    tier: 'intermediate',
    contentStatus: 'index-only',
    contentKind: 'lesson',
    owner: null,
    lastReviewed: null,
    waveformFeatures: [],
    protocols: [],
    concepts: [],
    prerequisites: [],
    next: [],
    pairWith: [],
    references: [],
    artifactPrompt: null,
    reviewNotes: ['Planned fixture'],
    tags: [shardId],
    sourceRecord: {
      document: 'fixture.md',
      title: `Sample ${sourceNumber}`,
      body: [],
    },
  };
}

async function writeCatalogFixture(
  mutate: (state: FixtureState) => void = () => {},
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'waves-catalog-check-'));
  temporaryRoots.push(root);
  const samplesDir = join(root, 'public', 'samples');
  const catalogDir = join(samplesDir, 'catalog');
  await mkdir(catalogDir, { recursive: true });

  const shardDocuments: FixtureShardDocument[] = SHARDS.map(([id, start, end]) => {
    const entries = Array.from({ length: end - start + 1 }, (_, index) =>
      curriculumEntry(id, start + index),
    );
    const descriptor = {
      id,
      label: id,
      path: `catalog/${id}.json`,
      sourceNumberRange: { start, end },
      curriculumCount: entries.length,
      entryCount: entries.length,
      assetEntryCount: 0,
    };
    return {
      descriptor,
      document: {
        schemaVersion: 1,
        catalogVersion: 'v1',
        shard: { ...descriptor },
        entries,
      },
    };
  });
  const index: FixtureIndex = {
    schemaVersion: 1,
    catalogVersion: 'v1',
    generatedFrom: 'fixture.md',
    curriculumCount: 832,
    entryCount: 832,
    assetEntryCount: 0,
    shardCount: 13,
    shards: shardDocuments.map(({ descriptor }) => descriptor),
  };
  mutate({ index, shardDocuments });
  await Promise.all(
    shardDocuments.map(({ descriptor, document }) =>
      writeFile(join(samplesDir, descriptor.path), JSON.stringify(document), 'utf8'),
    ),
  );
  await writeFile(join(samplesDir, 'catalog.v1.json'), JSON.stringify(index), 'utf8');
  return root;
}

describe('sample catalog build-time validator', () => {
  it('accepts an exact, internally consistent 832-entry curriculum', async () => {
    const rootDir = await writeCatalogFixture();
    const result = await validateSampleCatalog({ rootDir });

    expect(result.errors).toEqual([]);
    expect(result.stats).toEqual({
      entries: 832,
      curriculumEntries: 832,
      assetEntries: 0,
      shards: 13,
    });
  });

  it('reports alias cycles, self-pairs, and missing curriculum coverage together', async () => {
    const rootDir = await writeCatalogFixture(({ index, shardDocuments }) => {
      index.aliases = { old: 'older', older: 'old' };
      const first = shardDocuments[0].document.entries[0];
      first.pairWith = [first.id];
      shardDocuments[0].document.entries.splice(1, 1);
      shardDocuments[0].descriptor.curriculumCount -= 1;
      shardDocuments[0].descriptor.entryCount -= 1;
      Object.assign(shardDocuments[0].document.shard, shardDocuments[0].descriptor);
      index.entryCount -= 1;
      index.shards[0] = shardDocuments[0].descriptor;
    });
    const result = await validateSampleCatalog({ rootDir });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('missing curriculum sourceNumber 2'),
        expect.stringContaining('self-pairs are not allowed'),
        expect.stringContaining('alias cycle'),
      ]),
    );
  });
});
