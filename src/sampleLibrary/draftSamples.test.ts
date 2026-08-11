import { afterEach, describe, expect, it } from 'vitest';
import { access, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { loadDraftSamples } from '../../scripts/draft-samples.mjs';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function writeRegistry(document: unknown): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'waves-draft-samples-'));
  temporaryRoots.push(root);
  const registryFile = join(root, 'draft-samples.v1.json');
  await writeFile(registryFile, JSON.stringify(document), 'utf8');
  return registryFile;
}

function registry(entries: unknown[]) {
  return { schemaVersion: 1, catalogVersion: 'v1', entries };
}

const draftSample = {
  sourceNumber: 55,
  asset: {
    path: 'waveforms/cdc/single-bit-two-flop-synchronizer.json',
    format: 'wavedrom-json',
  },
};

async function waveformFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? waveformFiles(path) : [path];
  }));
  return nested.flat();
}

describe('draft sample registry', () => {
  it('turns one minimal source-number and asset record into a draft mapping', async () => {
    const registryFile = await writeRegistry(registry([draftSample]));

    await expect(loadDraftSamples({ registryFile, allowMissing: false })).resolves.toEqual(new Map([
      [55, draftSample],
    ]));
  });

  it('maps every authored local waveform explicitly without review metadata', async () => {
    const drafts = await loadDraftSamples({ allowMissing: false });
    const root = process.cwd();
    const registeredPaths = new Set([...drafts.values()].map(({ asset }) => asset.path));
    const authoredPaths = (await waveformFiles(join(root, 'public', 'samples', 'waveforms')))
      .map((file) => relative(join(root, 'public', 'samples'), file).replaceAll('\\', '/'));

    expect(drafts.size).toBe(120);
    expect([...drafts.keys()].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 120 }, (_, index) => index + 41),
    );
    expect(registeredPaths).toEqual(new Set(authoredPaths));
    await Promise.all([...registeredPaths].map((path) => access(join(root, 'public', 'samples', path))));
  });

  it.each([
    [{ ...draftSample, sourceNumber: 0 }, 'sourceNumber'],
    [{ ...draftSample, asset: { ...draftSample.asset, path: '../outside.json' } }, 'asset.path'],
    [{ ...draftSample, asset: { ...draftSample.asset, format: 'unknown' } }, 'asset.format'],
    [{ ...draftSample, reviewedBy: 'Reviewer' }, 'reviewedBy'],
    [{ ...draftSample, asset: { ...draftSample.asset, status: 'reviewed' } }, 'asset.status'],
  ])('rejects an invalid or accidentally promotable draft record', async (entry, expectedField) => {
    const registryFile = await writeRegistry(registry([entry]));

    await expect(loadDraftSamples({ registryFile, allowMissing: false }))
      .rejects.toThrow(expectedField);
  });

  it('rejects duplicate source numbers', async () => {
    const registryFile = await writeRegistry(registry([draftSample, draftSample]));

    await expect(loadDraftSamples({ registryFile, allowMissing: false }))
      .rejects.toThrow('duplicates sourceNumber 55');
  });
});
