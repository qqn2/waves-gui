/** @vitest-environment happy-dom */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { fromWavedromJSON, toWavedromJSON } from '../wavedromBridge';
import type { WdRoot } from '../wavedromBridge/wdTypes';
import { useStore } from '../shared/store';
import { DiagramStepsControl } from './DiagramStepsControl';

describe('DiagramStepsControl', () => {
  it('the + button appends a dot to clock waves, not an explicit n', async () => {
    const rootJson = JSON.parse(
      readFileSync(join(process.cwd(), 'public/samples/handshake.json'), 'utf8'),
    ) as WdRoot;
    useStore.getState().loadDiagram(fromWavedromJSON(rootJson));
    expect((toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string }).wave).toBe(
      'P.......',
    );

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<DiagramStepsControl />);
    });

    const moreSteps = host.querySelector<HTMLButtonElement>('button[aria-label="More steps"]');
    expect(moreSteps).not.toBeNull();

    await act(async () => {
      moreSteps!.click();
    });

    const wave = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string }).wave;
    expect(wave).toBe('P........');
    expect(wave.slice(1)).not.toMatch(/[pPnN]/);

    root.unmount();
    host.remove();
  });
});
