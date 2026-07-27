/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { useStore } from '../shared/store';
import { AnnotationInspector } from './AnnotationInspector';

describe('AnnotationInspector coordinates', () => {
  beforeEach(() => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    useStore.getState().setExtensionsEnabled(true);
  });

  it('edits exact X/Y values and coordinate mode', async () => {
    const id = useStore.getState().addTextAnnotation({
      text: 'positioned',
      tick: 0,
      x: 0.625,
      y: 1.375,
      coordinateMode: 'diagram',
      snapToGrid: false,
    })!;
    useStore.getState().setActiveAnnotationId(id);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<AnnotationInspector onClose={() => undefined} />);
    });

    const xInput = host.querySelector<HTMLInputElement>(
      'input[aria-label="Annotation X coordinate"]',
    );
    const yInput = host.querySelector<HTMLInputElement>(
      'input[aria-label="Annotation Y coordinate"]',
    );
    const mode = host.querySelector<HTMLSelectElement>(
      'select[aria-label="Annotation Y coordinate mode"]',
    );
    expect(xInput?.value).toBe('0.625');
    expect(yInput?.value).toBe('1.375');
    expect(mode?.value).toBe('diagram');

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(xInput, '1.125');
      xInput!.dispatchEvent(new Event('input', { bubbles: true }));
      xInput!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(useStore.getState().diagram.annotations?.[0]).toMatchObject({
      x: 1.125,
      y: 1.375,
    });

    await act(async () => root.unmount());
    host.remove();
  });

  it('edits ranged line bounds as indices or percentages', async () => {
    const id = useStore.getState().addVerticalLineAnnotation({
      tick: 1,
      rangeFrom: { unit: 'index', value: 0.5 },
      rangeTo: { unit: 'percent', value: 75 },
    })!;
    useStore.getState().setActiveAnnotationId(id);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<AnnotationInspector onClose={() => undefined} />);
    });

    const from = host.querySelector<HTMLInputElement>(
      'input[aria-label="Annotation range start"]',
    );
    const to = host.querySelector<HTMLInputElement>(
      'input[aria-label="Annotation range end"]',
    );
    expect(from?.value).toBe('0.5');
    expect(to?.value).toBe('75%');

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(from, '25%');
      from!.dispatchEvent(new Event('input', { bubbles: true }));
      from!.dispatchEvent(new Event('change', { bubbles: true }));
      from!.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(useStore.getState().diagram.annotations?.[0]).toMatchObject({
      rangeFrom: { unit: 'percent', value: 25 },
      rangeTo: { unit: 'percent', value: 75 },
    });

    await act(async () => root.unmount());
    host.remove();
  });
});
