/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-dom/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-dom/client')>();
  return { ...original, createRoot: vi.fn(original.createRoot) };
});

describe('main bootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.mocked(createRoot).mockClear();
  });

  afterEach(async () => {
    // Flush effect cleanup before happy-dom removes window and document.
    await act(async () => {
      for (const result of vi.mocked(createRoot).mock.results) {
        if (result.type === 'return') result.value.unmount();
      }
    });
    document.body.innerHTML = '';
  });

  it('mounts App into #root', async () => {
    await act(async () => { await import('./main'); });
    const root = document.getElementById('root');
    expect(createRoot).toHaveBeenCalledWith(root);
    expect(root?.querySelector('.appRoot')).toBeTruthy();
  }, 20_000);
});
