// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SampleBrowser } from './SampleBrowser';
import { CatalogRepository } from './catalogRepository';
import { CATALOG_SHARD_IDS, type CatalogIndexV1, type CatalogShardDescriptor, type SampleManifestEntry } from './catalogTypes';

function descriptor(id: (typeof CATALOG_SHARD_IDS)[number]): CatalogShardDescriptor {
  const populated = id === 'fundamentals';
  return {
    id,
    label: id === 'fundamentals' ? 'Fundamentals' : id === 'cdc' ? 'CDC' : id,
    path: `catalog/${id}.json`,
    sourceNumberRange: { start: 1, end: 832 },
    curriculumCount: populated ? 1 : 0,
    entryCount: populated ? 3 : 0,
    assetEntryCount: populated ? 2 : 0,
  };
}

type FixtureStatus = 'index-only' | 'draft' | 'reviewed';

function manifestEntry(contentStatus: FixtureStatus): SampleManifestEntry {
  const planned = contentStatus === 'index-only';
  const reviewed = contentStatus === 'reviewed';
  const slug = planned ? 'planned-lesson' : reviewed ? 'reviewed-handshake' : 'unvalidated-handshake';
  return {
    id: `fundamentals/${slug}`,
    sourceNumber: planned ? 1 : null,
    slug,
    shardId: 'fundamentals',
    title: planned ? 'Planned lesson' : reviewed ? 'Reviewed handshake' : 'Unvalidated handshake',
    description: planned ? 'Awaiting a waveform' : reviewed ? 'Ready to edit' : 'Awaiting validation',
    tier: 'essential',
    contentStatus,
    owner: reviewed ? 'Template maintainers' : null,
    lastReviewed: reviewed ? '2026-08-10' : null,
    protocols: [], concepts: [], waveformFeatures: [], prerequisites: [], next: [], pairWith: [],
    reviewNotes: [reviewed ? 'Validated in fixture' : 'Not reviewed'],
    references: reviewed ? [{ name: 'Fixture guide', edition: null, section: null }] : [], artifactPrompt: null,
    contentKind: 'lesson', tags: ['fundamentals'],
    sourceRecord: planned ? { document: 'docs/catalog.md', title: 'Planned lesson', body: ['Source 1'] } : null,
    ...(planned ? {} : {
      asset: { path: `${slug}.json`, format: 'wavedrom-json' as const, previewVersion: 'v1' },
    }),
  };
}

function fixtures() {
  const shards = CATALOG_SHARD_IDS.map(descriptor);
  const index: CatalogIndexV1 = {
    schemaVersion: 1,
    catalogVersion: 'v1',
    generatedFrom: 'docs/catalog.md',
    curriculumCount: 1,
    entryCount: 3,
    assetEntryCount: 2,
    shardCount: 13,
    aliases: {},
    shards,
  };
  const documents = new Map(shards.map((shard) => [
    `/waves/samples/${shard.path}`,
    {
      schemaVersion: 1,
      catalogVersion: 'v1',
      shard,
      entries: shard.id === 'fundamentals'
        ? [manifestEntry('index-only'), manifestEntry('draft'), manifestEntry('reviewed')]
        : [],
    },
  ]));
  return { index, documents };
}

function toggle(host: HTMLElement, label: string): HTMLInputElement {
  const control = Array.from(host.querySelectorAll('label'))
    .find((candidate) => candidate.textContent?.includes(label))
    ?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!control) throw new Error(`Could not find ${label} toggle`);
  return control;
}

async function settle(predicate: () => boolean): Promise<void> {
  for (let attempts = 0; attempts < 20; attempts += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    if (predicate()) return;
  }
  throw new Error(`UI did not settle: ${document.body.textContent}`);
}

describe('SampleBrowser lazy catalog integration', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('fetches nothing while closed, then only the index and default shard when opened', async () => {
    const { index, documents } = fixtures();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/waves/samples/catalog.v1.json') return new Response(JSON.stringify(index));
      const document = documents.get(url);
      if (document) return new Response(JSON.stringify(document));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const repository = new CatalogRepository({ baseUrl: '/waves/', fetch: fetchMock as typeof fetch });
    const props = { onClose: vi.fn(), onPick: vi.fn(), repository };

    await act(async () => root.render(<SampleBrowser {...props} open={false} />));
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => root.render(<SampleBrowser {...props} open />));
    await settle(() => host.textContent?.includes('Reviewed handshake') === true);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/waves/samples/catalog.v1.json',
      '/waves/samples/catalog/fundamentals.json',
    ]);
    expect(host.textContent).not.toContain('Unvalidated handshake');
    expect(host.textContent).not.toContain('Planned lesson');
    const bundledRow = Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Reviewed handshake'))!;
    await act(async () => bundledRow.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    expect(props.onPick).toHaveBeenCalledWith(expect.objectContaining({
      id: 'fundamentals/reviewed-handshake',
      assetUrl: '/waves/samples/reviewed-handshake.json',
    }));
  });

  it('loads one selected shard, reuses cached shards, and labels search scope', async () => {
    const { index, documents } = fixtures();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('catalog.v1.json')) return new Response(JSON.stringify(index));
      return new Response(JSON.stringify(documents.get(url)));
    });
    const repository = new CatalogRepository({ baseUrl: '/waves/', fetch: fetchMock as typeof fetch });
    await act(async () => root.render(<SampleBrowser open onClose={vi.fn()} onPick={vi.fn()} repository={repository} />));
    await settle(() => host.textContent?.includes('Reviewed handshake') === true);

    const cdc = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('CDC'))!;
    await act(async () => cdc.click());
    await settle(() => fetchMock.mock.calls.length === 3);
    const fundamentals = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Fundamentals'))!;
    await act(async () => fundamentals.click());
    await settle(() => host.textContent?.includes('Reviewed handshake') === true);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(host.textContent).toContain('Search is within this category');
  });

  it('reveals planned entries on request without loading previews or enabling edit copy', async () => {
    const { index, documents } = fixtures();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('catalog.v1.json')) return new Response(JSON.stringify(index));
      const document = documents.get(url);
      if (document) return new Response(JSON.stringify(document));
      throw new Error(`Asset fetch must not occur: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const onPick = vi.fn();
    const repository = new CatalogRepository({ baseUrl: '/waves/', fetch: fetchMock as typeof fetch });
    await act(async () => root.render(<SampleBrowser open onClose={vi.fn()} onPick={onPick} repository={repository} />));
    await settle(() => host.textContent?.includes('Reviewed handshake') === true);

    const plannedToggle = toggle(host, 'Include planned samples');
    await act(async () => plannedToggle.click());
    const plannedRow = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Planned lesson'))!;
    await act(async () => plannedRow.click());
    plannedRow.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(host.textContent).toContain('No waveform preview is available yet');
    const editButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Planned sample'))!;
    expect(editButton.disabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('keeps drafts out of normal browsing, then labels and warns about them after explicit opt-in', async () => {
    const { index, documents } = fixtures();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('catalog.v1.json')) return new Response(JSON.stringify(index));
      const document = documents.get(url);
      if (document) return new Response(JSON.stringify(document));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const repository = new CatalogRepository({ baseUrl: '/waves/', fetch: fetchMock as typeof fetch });
    await act(async () => root.render(<SampleBrowser open onClose={vi.fn()} onPick={vi.fn()} repository={repository} />));
    await settle(() => host.textContent?.includes('Reviewed handshake') === true);

    expect(host.textContent).toContain('Showing reviewed and featured samples');
    expect(host.textContent).not.toContain('Unvalidated handshake');
    const draftToggle = toggle(host, 'Include unvalidated drafts');
    await act(async () => draftToggle.click());
    await settle(() => host.textContent?.includes('Unvalidated handshake') === true);

    expect(host.textContent).toContain('Unvalidated drafts included');
    expect(host.textContent).toContain('Unvalidated');
    const draftRow = Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Unvalidated handshake'))!;
    await act(async () => draftRow.click());
    expect(host.textContent).toContain('Unvalidated draft.');
    expect(host.textContent).toContain('Edit unvalidated copy');
  });

  it('keeps unregistered local waveforms out of the live catalog under a non-root base URL', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const relative = url.replace('/waves/samples/', '');
      try {
        return new Response(readFileSync(resolve('public/samples', relative)));
      } catch {
        return new Response('Not found', { status: 404 });
      }
    });
    vi.stubGlobal('fetch', fetchMock);
    const onPick = vi.fn();
    const repository = new CatalogRepository({ baseUrl: '/waves/', fetch: fetchMock as typeof fetch });
    await act(async () => root.render(<SampleBrowser open onClose={vi.fn()} onPick={onPick} repository={repository} />));
    await settle(() => host.textContent?.includes('Clocking and reset') === true);

    const clocking = Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Clocking and reset'))!;
    await act(async () => clocking.click());
    const draftToggle = toggle(host, 'Include unvalidated drafts');
    await act(async () => draftToggle.click());
    await settle(() => host.textContent?.includes('Clock and reset') === true);
    expect(host.textContent).not.toContain('Clock divider by four');

    const plannedToggle = toggle(host, 'Include planned samples');
    await act(async () => plannedToggle.click());
    await settle(() => host.textContent?.includes('Clock divider by four') === true);
    const divider = Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Clock divider by four'))!;
    await act(async () => divider.click());
    divider.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(host.textContent).toContain('No waveform preview is available yet');
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/waveforms/clocking-reset/'))).toBe(false);
    expect(onPick).not.toHaveBeenCalled();
  });
});
