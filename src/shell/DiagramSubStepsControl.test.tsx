/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { useStore } from '../shared/store';
import { DiagramSubStepsControl } from './DiagramSubStepsControl';

describe('DiagramSubStepsControl', () => {
  it('raises to the next exact timing resolution', async () => {
    const diagram = createDefaultDiagram();
    diagram.compatibility = { extensionsEnabled: true };
    diagram.config.ticksPerStep = 4;
    const bit = diagram.signals.find((item) => item.type === 'bit');
    expect(bit?.type).toBe('bit');
    if (!bit || bit.type !== 'bit') return;
    bit.digitalTiming = {
      ticksPerStep: 4,
      phaseTicks: 1,
      cells: bit.states.map((state) => ({ state, durationTicks: 4 })),
    };
    useStore.getState().loadDiagram(diagram);

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<DiagramSubStepsControl />));

    const input = host.querySelector<HTMLInputElement>(
      'input[aria-label="Timing grid divisions per step"]',
    );
    const raise = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Refine timing grid"]',
    );
    expect(host.textContent).toContain('Timing grid');
    expect(input?.value).toBe('4');

    await act(async () => raise!.click());
    expect(input?.value).toBe('8');

    root.unmount();
    host.remove();
  });
});
