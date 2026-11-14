// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSVGString } from '../exportEngine/exportSVG';
import { useStore } from '../shared/store';
import { defaultDiagram, defaultView } from '../shared/store/helpers';
import type { DiagramState } from '../shared/types';
import { loadSampleDiagram } from '../shell/samples';
import { loadSamplePreview } from './previewLoader';
import { SampleBrowser } from './SampleBrowser';

vi.mock('../exportEngine/exportSVG', () => ({ buildSVGString: vi.fn() }));
vi.mock('./previewLoader', () => ({ loadSamplePreview: vi.fn() }));
vi.mock('../shell/samples', async (importOriginal) => ({
  ...await importOriginal<typeof import('../shell/samples')>(),
  loadSampleDiagram: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe('sample browser interactions', () => {
  let host: HTMLDivElement;
  let root: Root;
  let opener: HTMLButtonElement;
  const closed = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    const diagram = defaultDiagram();
    useStore.setState({ diagram, savedDiagram: diagram, view: defaultView(), history: [], future: [] });
    vi.mocked(loadSamplePreview).mockReset().mockResolvedValue(defaultDiagram());
    vi.mocked(loadSampleDiagram).mockReset().mockResolvedValue(false);
    vi.mocked(buildSVGString).mockReturnValue('<svg xmlns="http://www.w3.org/2000/svg"/>');
    let nextUrl = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:preview-${++nextUrl}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    // Native focus trapping and top-layer behavior are covered by browser tests.
    vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function () { this.open = true; });
    vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function () { this.open = false; });
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined);
    opener = document.createElement('button');
    opener.textContent = 'Browse samples';
    document.body.appendChild(opener);
    opener.focus();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    opener.remove();
    vi.restoreAllMocks();
  });

  async function render() {
    await act(async () => root.render(<SampleBrowser onClose={() => {
      closed();
      root.render(null);
    }} />));
  }

  function button(text: string): HTMLButtonElement {
    const found = Array.from(host.querySelectorAll('button')).find((item) => item.textContent?.trim() === text);
    if (!found) throw new Error(`Missing button ${text}`);
    return found;
  }

  function result(id: string): HTMLButtonElement {
    return host.querySelector<HTMLButtonElement>(`[data-sample-id="${id}"]`)!;
  }

  async function click(element: HTMLElement) {
    await act(async () => element.click());
  }

  async function search(query: string) {
    const input = host.querySelector<HTMLInputElement>('input[aria-label="Search samples"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, query);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  it('previews selection and search without touching the open editor document', async () => {
    useStore.getState().addSignal('bit');
    useStore.getState().setSourceDraftStatus(true, 'Incomplete', '{ unfinished');
    const editor = useStore.getState();
    await render();
    expect(document.activeElement).toBe(host.querySelector('input'));
    expect(loadSamplePreview).toHaveBeenCalledWith(expect.objectContaining({ id: 'amba/apb/write' }), expect.any(AbortSignal));
    await click(result('amba/apb/read'));
    expect(host.querySelector('[aria-selected="true"]')?.getAttribute('data-sample-id')).toBe('amba/apb/read');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
    await search('AXI read');

    expect(host.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(host.querySelector('[role="option"]')?.getAttribute('data-sample-id')).toBe('amba/axi/read');
    expect(loadSamplePreview).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'amba/axi/read' }), expect.any(AbortSignal));
    expect(useStore.getState()).toBe(editor);
    expect(loadSampleDiagram).not.toHaveBeenCalled();
  });

  it('keeps one result in the tab order and follows arrow-key focus', async () => {
    await render();
    const input = host.querySelector('input')!;
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(document.activeElement).toBe(result('amba/apb/write'));
    await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(document.activeElement).toBe(result('amba/apb/read'));
    expect(result('amba/apb/read').getAttribute('aria-selected')).toBe('true');
    expect(Array.from(host.querySelectorAll<HTMLButtonElement>('[role="option"]')).filter((item) => item.tabIndex === 0))
      .toEqual([result('amba/apb/read')]);
    expect(loadSampleDiagram).not.toHaveBeenCalled();
  });

  it('ignores an older preview that finishes after a newer selection', async () => {
    const oldPreview = deferred<DiagramState>();
    const nextPreview = deferred<DiagramState>();
    vi.mocked(loadSamplePreview).mockReturnValueOnce(oldPreview.promise).mockReturnValueOnce(nextPreview.promise);
    await render();
    const oldSignal = vi.mocked(loadSamplePreview).mock.calls[0]![1]!;
    await click(result('amba/apb/read'));
    expect(oldSignal.aborted).toBe(true);
    expect(host.textContent).toContain('Loading waveform');
    await act(async () => nextPreview.resolve(defaultDiagram()));
    const currentImage = host.querySelector('img');
    expect(currentImage?.alt).toContain('APB read');
    await act(async () => oldPreview.resolve(defaultDiagram()));

    expect(host.querySelector('img')).toBe(currentImage);
    expect(buildSVGString).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it('shows preview failures inline and retries the selected sample', async () => {
    vi.mocked(loadSamplePreview).mockRejectedValueOnce(new Error('Offline'));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Preview unavailable');
    expect(host.textContent).toContain('Offline');
    await click(button('Retry preview'));

    expect(host.querySelector('img')?.alt).toContain('APB write');
    expect(host.textContent).not.toContain('Offline');
    expect(loadSamplePreview).toHaveBeenCalledTimes(2);
    expect(loadSampleDiagram).not.toHaveBeenCalled();
  });

  it('keeps the browser open after a failed or declined copy and allows another attempt', async () => {
    vi.mocked(loadSampleDiagram)
      .mockRejectedValueOnce(new Error('Could not fetch source'))
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await render();
    await click(button('Open copy'));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not fetch source');
    expect(closed).not.toHaveBeenCalled();
    await click(button('Open copy'));
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(closed).not.toHaveBeenCalled();
    await click(button('Open copy'));

    expect(closed).toHaveBeenCalledOnce();
    expect(host.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('cancels a pending copy when selection changes and ignores its late completion', async () => {
    const oldOpen = deferred<boolean>();
    const nextOpen = deferred<boolean>();
    vi.mocked(loadSampleDiagram).mockReturnValueOnce(oldOpen.promise).mockReturnValueOnce(nextOpen.promise);
    await render();
    await click(button('Open copy'));
    expect(button('Opening…').disabled).toBe(true);
    const oldSignal = vi.mocked(loadSampleDiagram).mock.calls[0]![1]!;
    await click(result('amba/apb/read'));
    expect(oldSignal.aborted).toBe(true);
    await click(button('Open copy'));
    await act(async () => oldOpen.resolve(true));

    expect(closed).not.toHaveBeenCalled();
    expect(button('Opening…').disabled).toBe(true);
    await act(async () => nextOpen.resolve(true));
    expect(closed).toHaveBeenCalledOnce();
    expect(loadSampleDiagram).toHaveBeenLastCalledWith('amba/apb/read', expect.any(AbortSignal));
  });

  it('aborts both pending operations on close and ignores late failures', async () => {
    const preview = deferred<DiagramState>();
    const opening = deferred<boolean>();
    vi.mocked(loadSamplePreview).mockReturnValueOnce(preview.promise);
    vi.mocked(loadSampleDiagram).mockReturnValueOnce(opening.promise);
    await render();
    await click(button('Open copy'));
    const previewSignal = vi.mocked(loadSamplePreview).mock.calls[0]![1]!;
    const openSignal = vi.mocked(loadSampleDiagram).mock.calls[0]![1]!;
    await click(host.querySelector<HTMLButtonElement>('[aria-label="Close sample library"]')!);

    expect(previewSignal.aborted).toBe(true);
    expect(openSignal.aborted).toBe(true);
    await act(async () => {
      preview.reject(new Error('Late preview failure'));
      opening.reject(new Error('Late open failure'));
    });
    expect(closed).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });

  it('clears search with Escape and recovers from an empty result set', async () => {
    await render();
    await search('no such sample');
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(host.textContent).toContain('No matching samples');
    expect(host.querySelector('img')).toBeNull();
    const input = host.querySelector('input')!;
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(closed).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(10);
    await search('no such sample');
    await click(button('Show all samples'));
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(19);
  });
});
