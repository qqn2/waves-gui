import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../defaultDiagram';
import { useStore } from './index';

describe('annotation actions', () => {
  beforeEach(() => {
    useStore.getState().loadDiagram(createDefaultDiagram());
  });

  it('keeps annotation creation locked while extensions are disabled', () => {
    const id = useStore.getState().addTextAnnotation({
      text: 'hidden',
      tick: 1,
    });
    expect(id).toBeNull();
    expect(useStore.getState().diagram.annotations).toEqual([]);
  });

  it('adds, updates, removes, and restores a text annotation through undo', () => {
    useStore.getState().setExtensionsEnabled(true);
    const signal = useStore.getState().diagram.signals.find(
      (item) => item.type === 'bit',
    );
    const id = useStore.getState().addTextAnnotation({
      text: 'Setup',
      tick: 2,
      signalId: signal?.id,
      yOffset: -8,
    });

    expect(id).not.toBeNull();
    expect(useStore.getState().diagram.annotations).toEqual([
      {
        id,
        type: 'text',
        text: 'Setup',
        tick: 2,
        signalId: signal?.id,
        yOffset: -8,
      },
    ]);

    useStore.getState().updateTextAnnotation(id!, {
      text: 'Hold',
      tick: 999,
    });
    expect(useStore.getState().diagram.annotations?.[0]).toMatchObject({
      text: 'Hold',
      tick: useStore.getState().diagram.config.totalSteps - 1,
    });

    useStore.getState().removeAnnotation(id!);
    expect(useStore.getState().diagram.annotations).toEqual([]);

    useStore.getState().undo();
    expect(useStore.getState().diagram.annotations?.[0]?.id).toBe(id);
    useStore.getState().undo();
    expect(useStore.getState().diagram.annotations?.[0]).toMatchObject({
      text: 'Setup',
      tick: 2,
    });
  });

  it('locks existing annotations again when extension mode is hidden', () => {
    useStore.getState().setExtensionsEnabled(true);
    const id = useStore.getState().addTextAnnotation({ text: 'note', tick: 0 });
    useStore.getState().setExtensionsEnabled(false);

    useStore.getState().updateTextAnnotation(id!, { text: 'changed' });
    useStore.getState().removeAnnotation(id!);

    expect(useStore.getState().diagram.annotations?.[0]?.text).toBe('note');
  });
});
