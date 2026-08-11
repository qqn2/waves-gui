import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SampleLibraryEntry } from './catalog';
import { clearSamplePreviewCache, loadSamplePreview } from './previewLoader';

const sampleSource = JSON.stringify({ signal: [{ name: 'clk', wave: 'p...' }] });

function entry(index = 0): SampleLibraryEntry {
  return {
    id: `fundamentals/sample-${index}`,
    sourceNumber: null,
    slug: `sample-${index}`,
    shardId: 'fundamentals',
    title: `Sample ${index}`,
    description: 'Sample',
    tier: 'essential',
    contentStatus: 'draft',
    owner: null,
    lastReviewed: null,
    protocols: [], concepts: [], waveformFeatures: [], prerequisites: [], next: [], pairWith: [],
    reviewNotes: ['Draft'], references: [], artifactPrompt: null, contentKind: 'lesson', tags: [], sourceRecord: null,
    asset: { path: `sample-${index}.json`, format: 'wavedrom-json', previewVersion: 'v1' },
    assetUrl: `/samples/sample-${index}.json`, previewVersion: 'v1', source: 'WaveDrom JSON', format: 'wavedrom-json',
  };
}

describe('sample preview loader', () => {
  afterEach(() => { clearSamplePreviewCache(); vi.unstubAllGlobals(); });

  it('parses an asset once and reuses the bounded preview cache', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(sampleSource)));
    vi.stubGlobal('fetch', fetchMock);
    const sample = entry();
    const first = await loadSamplePreview(sample);
    const second = await loadSamplePreview(sample);
    expect(first.signals).toHaveLength(1);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not fetch cancelled or index-only previews', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(loadSamplePreview(entry(), controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    await expect(loadSamplePreview({
      ...entry(), contentStatus: 'index-only', asset: undefined, assetUrl: undefined,
    })).rejects.toThrow(/does not have a waveform asset/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('evicts the least recently used preview when the cache reaches its limit', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(sampleSource)));
    vi.stubGlobal('fetch', fetchMock);
    const entries = Array.from({ length: 7 }, (_, index) => entry(index));
    for (const sample of entries) await loadSamplePreview(sample);
    await loadSamplePreview(entries[0]!);
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });
});
