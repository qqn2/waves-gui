// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../shared/store';
import { loadSampleDiagramAsset } from './samples';

describe('manifest sample asset loading', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fetches and opens a nested manifest asset URL without a static catalog lookup', async () => {
    useStore.setState((state) => {
      state.view.isDirty = false;
      state.view.sourceDraftDirty = false;
    });
    const source = JSON.stringify({
      signal: [
        { name: 'clk', wave: 'p.......' },
        { name: 'clk_div4', wave: '0.1...0.' },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(source));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadSampleDiagramAsset({
      id: 'clocking-reset/clock-divider-by-four',
      file: 'waveforms/clocking-reset/clock-divider-by-four.json',
      assetUrl: '/waves/samples/waveforms/clocking-reset/clock-divider-by-four.json',
      format: 'wavedrom-json',
    })).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      '/waves/samples/waveforms/clocking-reset/clock-divider-by-four.json',
    );
    expect(useStore.getState().diagram.signals.map((signal) => signal.name))
      .toEqual(['clk', 'clk_div4']);
  });
});
