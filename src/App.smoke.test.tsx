/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import App from './App';
import { useStore } from './shared/store';

describe('App smoke', () => {
  it('renders without throwing', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<App />);
    });

    expect(host.innerHTML.length).toBeGreaterThan(0);
    expect(host.querySelector('aside[aria-label="Properties inspector"]')).toBeNull();

    const inspectorToggle = host.querySelector<HTMLButtonElement>(
      'button[title="Select a bus to inspect its properties"]',
    );
    expect(inspectorToggle).not.toBeNull();
    expect(inspectorToggle!.disabled).toBe(true);

    const hscaleInput = host.querySelector<HTMLInputElement>(
      'input[aria-label="WaveDrom horizontal scale"]',
    );
    expect(hscaleInput).not.toBeNull();
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      valueSetter?.call(hscaleInput, '2');
      hscaleInput!.dispatchEvent(new Event('input', { bubbles: true }));
      hscaleInput!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(useStore.getState().diagram.config.hscale).toBe(2);

    root.unmount();
    host.remove();
  });
});
