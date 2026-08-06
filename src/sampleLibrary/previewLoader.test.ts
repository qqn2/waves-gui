import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_LIBRARY_CATALOG } from './catalog';
import {
  clearSamplePreviewCache,
  loadSamplePreview,
} from './previewLoader';

const sampleSource = JSON.stringify({
  signal: [{ name: 'clk', wave: 'p...' }],
});

describe('sample preview loader', () => {
  afterEach(() => {
    clearSamplePreviewCache();
    vi.unstubAllGlobals();
  });

  it('parses an asset once and reuses the bounded preview cache', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(sampleSource)));
    vi.stubGlobal('fetch', fetchMock);
    const entry = SAMPLE_LIBRARY_CATALOG[0]!;

    const first = await loadSamplePreview(entry);
    const second = await loadSamplePreview(entry);

    expect(first.signals).toHaveLength(1);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not fetch a preview when its request is already cancelled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();

    await expect(loadSamplePreview(SAMPLE_LIBRARY_CATALOG[0]!, controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('evicts the least recently used preview when the cache reaches its limit', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(sampleSource)));
    vi.stubGlobal('fetch', fetchMock);
    const entries = SAMPLE_LIBRARY_CATALOG.slice(0, 7);

    for (const entry of entries) await loadSamplePreview(entry!);
    await loadSamplePreview(entries[0]!);

    expect(fetchMock).toHaveBeenCalledTimes(8);
  });
});
