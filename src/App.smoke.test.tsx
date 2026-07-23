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
      'button[title="Select one signal to inspect its properties"]',
    );
    expect(inspectorToggle).not.toBeNull();
    expect(inspectorToggle!.disabled).toBe(true);

    const bitSignal = useStore.getState().diagram.signals.find((signal) => signal.type === 'bit');
    expect(bitSignal).toBeDefined();
    await act(async () => {
      useStore.getState().setActiveSignalIds([bitSignal!.id]);
    });
    expect(inspectorToggle!.disabled).toBe(false);
    expect(host.querySelector('aside[aria-label="Properties inspector"]')).toBeNull();

    await act(async () => {
      inspectorToggle!.click();
    });
    const inspector = host.querySelector('aside[aria-label="Properties inspector"]');
    expect(inspector).not.toBeNull();
    expect(inspector?.textContent).toContain('Signal inspector');
    expect(inspector?.textContent).toContain('Timing');
    expect(inspector?.querySelector('input[value="Bit"]')).not.toBeNull();

    const periodInput = inspector?.querySelector<HTMLInputElement>(
      'input[aria-label="Signal period"]',
    );
    expect(periodInput).not.toBeNull();
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      valueSetter?.call(periodInput, '3');
      periodInput!.dispatchEvent(new Event('input', { bubbles: true }));
      periodInput!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const editedBit = useStore.getState().diagram.signals.find(
      (signal) => signal.id === bitSignal!.id,
    );
    expect(editedBit?.type === 'bit' ? editedBit.period : undefined).toBe(3);

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

    const extensionsToggle = host.querySelector<HTMLInputElement>(
      'input[aria-label="Undulate extensions"]',
    );
    expect(extensionsToggle).not.toBeNull();
    expect(extensionsToggle!.checked).toBe(false);
    await act(async () => {
      extensionsToggle!.click();
    });
    expect(useStore.getState().diagram.compatibility?.extensionsEnabled).toBe(true);

    root.unmount();
    host.remove();
  });
});
