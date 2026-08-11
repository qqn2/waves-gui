import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadValidatedSamples,
  validationReference,
  validationReviewNote,
} from '../../scripts/validated-samples.mjs';
import { PUBLISHED_SAMPLES } from '../../scripts/sample-catalog-source.mjs';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function writeRegistry(document: unknown): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'waves-validated-samples-'));
  temporaryRoots.push(root);
  const registryFile = join(root, 'validated-samples.v1.json');
  await writeFile(registryFile, JSON.stringify(document), 'utf8');
  return registryFile;
}

function registry(entries: unknown[]) {
  return { schemaVersion: 1, catalogVersion: 'v1', entries };
}

const reviewedSample = {
  sourceNumber: 55,
  asset: {
    path: 'waveforms/cdc/single-bit-two-flop-synchronizer.json',
    format: 'wavedrom-json',
  },
  reviewedBy: 'Reviewer',
  reviewedOn: '2026-08-10',
  validationEvidence: 'Compared timing semantics and generated light/dark previews.',
};

const reviewedLegacySample = {
  legacyId: 'undulate/ludwig/wavetest',
  reviewedBy: 'Waves GUI automated compatibility validation',
  reviewedOn: '2026-08-10',
  validationEvidence: 'Bundled parser, renderer, and Ludwig compatibility fixture coverage pass.',
};

describe('validated sample registry', () => {
  it('turns one human-editable record into review metadata', async () => {
    const registryFile = await writeRegistry(registry([reviewedSample]));

    const samples = await loadValidatedSamples({ registryFile, allowMissing: false });
    const sample = samples.get(55);

    expect(sample).toEqual({ ...reviewedSample, status: 'reviewed' });
    expect(validationReference(sample!)).toEqual({
      name: 'Validation evidence',
      edition: '2026-08-10',
      section: reviewedSample.validationEvidence,
    });
    expect(validationReviewNote(sample!)).toContain('Validated by Reviewer on 2026-08-10');
  });

  it('promotes a frozen legacy bundle by ID without allowing a duplicate asset mapping', async () => {
    const registryFile = await writeRegistry(registry([reviewedLegacySample]));

    const samples = await loadValidatedSamples({ registryFile, allowMissing: false });
    expect(samples.get(reviewedLegacySample.legacyId)).toEqual({
      ...reviewedLegacySample,
      status: 'reviewed',
    });

    const invalidRegistry = await writeRegistry(registry([{
      ...reviewedLegacySample,
      asset: reviewedSample.asset,
    }]));
    await expect(loadValidatedSamples({ registryFile: invalidRegistry, allowMissing: false }))
      .rejects.toThrow(/frozen bundled asset mapping/i);
  });

  it('contains reviewed records for every frozen published legacy sample', async () => {
    const samples = await loadValidatedSamples({ allowMissing: false });
    const legacyIds = [...samples.keys()].filter((target): target is string => typeof target === 'string');

    expect(new Set(legacyIds)).toEqual(new Set(PUBLISHED_SAMPLES.map(({ id }) => id)));
    expect(legacyIds).toHaveLength(PUBLISHED_SAMPLES.length);
  });

  it.each([
    [{ ...reviewedSample, validationEvidence: '' }, 'validationEvidence'],
    [{ ...reviewedSample, reviewedOn: '2026-15-40' }, 'reviewedOn'],
    [{ ...reviewedSample, asset: { ...reviewedSample.asset, path: '../outside.json' } }, 'asset.path'],
    [{ ...reviewedSample, status: 'draft' }, 'status'],
    [{ ...reviewedLegacySample, legacyId: 'general//clock-reset' }, 'legacyId'],
    [{ ...reviewedLegacySample, sourceNumber: 55 }, 'exactly one'],
  ])('rejects an invalid promotion record', async (entry, expectedField) => {
    const registryFile = await writeRegistry(registry([entry]));

    await expect(loadValidatedSamples({ registryFile, allowMissing: false }))
      .rejects.toThrow(expectedField);
  });

  it('rejects duplicate promotions for the same curriculum entry', async () => {
    const registryFile = await writeRegistry(registry([reviewedSample, reviewedSample]));

    await expect(loadValidatedSamples({ registryFile, allowMissing: false }))
      .rejects.toThrow('duplicates sourceNumber 55');
  });
});
