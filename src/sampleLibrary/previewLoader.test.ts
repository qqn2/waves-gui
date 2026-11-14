import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../shared/store';
import { SAMPLE_LIBRARY_CATALOG } from './catalog';
import { clearSamplePreviewCache, loadSamplePreview, SAMPLE_PREVIEW_CACHE_LIMIT } from './previewLoader';

const source = JSON.stringify({ signal: [{ name: 'preview', wave: '01..' }] });

describe('sample previews', () => {
  afterEach(() => {
    clearSamplePreviewCache();
    vi.unstubAllGlobals();
  });

  it('reuses parsed assets while isolating previews from the editor and each other', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(source)));
    vi.stubGlobal('fetch', fetchMock);
    const editor = useStore.getState();
    const first = await loadSamplePreview(SAMPLE_LIBRARY_CATALOG[0]!);
    first.signals.length = 0;
    const second = await loadSamplePreview(SAMPLE_LIBRARY_CATALOG[0]!);

    expect(second.signals).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(useStore.getState()).toBe(editor);
  });

  it('evicts the least recently used preview and refreshes entries on cache hits', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(source)));
    vi.stubGlobal('fetch', fetchMock);
    for (const entry of SAMPLE_LIBRARY_CATALOG.slice(0, SAMPLE_PREVIEW_CACHE_LIMIT)) {
      await loadSamplePreview(entry);
    }
    await loadSamplePreview(SAMPLE_LIBRARY_CATALOG[0]!);
    await loadSamplePreview(SAMPLE_LIBRARY_CATALOG[SAMPLE_PREVIEW_CACHE_LIMIT]!);
    await loadSamplePreview(SAMPLE_LIBRARY_CATALOG[0]!);
    expect(fetchMock).toHaveBeenCalledTimes(SAMPLE_PREVIEW_CACHE_LIMIT + 1);
    await loadSamplePreview(SAMPLE_LIBRARY_CATALOG[1]!);
    expect(fetchMock).toHaveBeenCalledTimes(SAMPLE_PREVIEW_CACHE_LIMIT + 2);
  });

  it('does not fetch an already cancelled request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();

    await expect(loadSamplePreview(SAMPLE_LIBRARY_CATALOG[0]!, controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not cache a request cancelled while the response body is loading', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => { controller.abort(); return source; } })
      .mockResolvedValueOnce(new Response(source));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadSamplePreview(SAMPLE_LIBRARY_CATALOG[0]!, controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' });
    await loadSamplePreview(SAMPLE_LIBRARY_CATALOG[0]!);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('allows a failed preview to be retried', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response('{ invalid'))
      .mockResolvedValueOnce(new Response(source));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadSamplePreview(SAMPLE_LIBRARY_CATALOG[0]!)).rejects.toThrow('503');
    await expect(loadSamplePreview(SAMPLE_LIBRARY_CATALOG[0]!)).rejects.toThrow();
    expect((await loadSamplePreview(SAMPLE_LIBRARY_CATALOG[0]!)).signals).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
