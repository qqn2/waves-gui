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
      'button[title="Show or hide properties inspector"]',
    );
    expect(inspectorToggle).not.toBeNull();
    expect(inspectorToggle!.disabled).toBe(false);

    await act(async () => {
      inspectorToggle!.click();
    });
    expect(
      host.querySelector('aside[aria-label="Properties inspector"]')?.textContent,
    ).toContain('Select a signal or annotation');

    const bitSignal = useStore.getState().diagram.signals.find((signal) => signal.type === 'bit');
    expect(bitSignal).toBeDefined();
    await act(async () => {
      useStore.getState().setActiveSignalIds([bitSignal!.id]);
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
      periodInput!.focus();
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      valueSetter?.call(periodInput, '3');
      periodInput!.dispatchEvent(new Event('input', { bubbles: true }));
      periodInput!.dispatchEvent(new Event('change', { bubbles: true }));
      periodInput!.blur();
    });
    const editedBit = useStore.getState().diagram.signals.find(
      (signal) => signal.id === bitSignal!.id,
    );
    expect(editedBit?.type === 'bit' ? editedBit.period : undefined).toBe(3);

    const diagramControlsToggle = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Diagram settings"]',
    );
    expect(diagramControlsToggle).not.toBeNull();
    expect(diagramControlsToggle!.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('input[aria-label="Diagram step count"]')).not.toBeNull();
    const substeps = host.querySelector<HTMLInputElement>(
      'input[aria-label="Diagram substep count"]',
    );
    expect(substeps).not.toBeNull();
    expect(substeps!.disabled).toBe(true);
    await act(async () => {
      diagramControlsToggle!.click();
    });
    expect(diagramControlsToggle!.getAttribute('aria-expanded')).toBe('true');
    const hscaleInput = host.querySelector<HTMLInputElement>(
      'input[aria-label="WaveDrom horizontal scale"]',
    );
    expect(hscaleInput).not.toBeNull();

    await act(async () => {
      hscaleInput!.focus();
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      valueSetter?.call(hscaleInput, '2');
      hscaleInput!.dispatchEvent(new Event('input', { bubbles: true }));
      hscaleInput!.dispatchEvent(new Event('change', { bubbles: true }));
      hscaleInput!.blur();
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
    expect(substeps!.disabled).toBe(false);

    await act(async () => {
      useStore.getState().setTicksPerStep(4);
      useStore.getState().setActiveSignalIds([bitSignal!.id]);
    });
    const fineTimingButton = Array.from(
      host.querySelectorAll<HTMLButtonElement>('button'),
    ).find(
      (button) => button.textContent?.includes('Enable fine timing for selected signal'),
    );
    expect(fineTimingButton).toBeDefined();
    await act(async () => {
      fineTimingButton!.click();
    });
    const timedBit = useStore.getState().diagram.signals.find(
      (signal) => signal.id === bitSignal!.id,
    );
    expect(timedBit?.type === 'bit' ? timedBit.digitalTiming : undefined)
      .toMatchObject({ ticksPerStep: 4 });
    expect(
      host.querySelector('aside[aria-label="Properties inspector"]')?.textContent,
    ).toContain('Timing grid: 4 divisions per step.');
    expect(
      host.querySelectorAll('input[aria-label="Fine timing phase"]'),
    ).toHaveLength(1);
    expect(
      host.querySelectorAll('input[aria-label="Signal phase"]'),
    ).toHaveLength(0);

    await act(async () => {
      useStore.getState().addSignal('analogue');
      const analogueSignal = useStore.getState().diagram.signals.find(
        (signal) => signal.type === 'analogue',
      );
      expect(analogueSignal).toBeDefined();
      useStore.getState().setActiveSignalIds([analogueSignal!.id]);
    });
    expect(inspectorToggle!.disabled).toBe(false);
    expect(
      host.querySelector('aside[aria-label="Properties inspector"]')?.textContent,
    ).toContain('Analog inspector');
    expect(
      host.querySelector('aside[aria-label="Properties inspector"]')?.textContent,
    ).toContain('Static context');

    await act(async () => {
      const annotationId = useStore.getState().addTextAnnotation({
        text: 'Setup note',
        tick: 1,
        signalId: bitSignal!.id,
      });
      useStore.getState().setActiveAnnotationId(annotationId);
    });
    expect(host.querySelector('aside[aria-label="Annotation inspector"]')).not.toBeNull();
    expect(
      host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Annotation text"]')?.value,
    ).toBe('Setup note');

    root.unmount();
    host.remove();
  });
});
