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

    expect(useStore.getState().diagram.annotations?.[0]).toMatchObject({
      type: 'text',
      text: 'note',
    });
  });

  it('adds and updates line annotations through undoable actions', () => {
    useStore.getState().setExtensionsEnabled(true);
    const signal = useStore.getState().diagram.signals.find(
      (item) => item.type === 'bit',
    );
    const verticalId = useStore.getState().addVerticalLineAnnotation({ tick: 2 });
    const horizontalId = useStore.getState().addHorizontalLineAnnotation({
      signalId: signal?.id,
      yOffset: 3,
    });
    const compressionId = useStore.getState().addGlobalCompressionAnnotation({
      tick: 1,
    });
    useStore.getState().updateVerticalLineAnnotation(verticalId!, { tick: 4 });
    useStore.getState().updateHorizontalLineAnnotation(horizontalId!, {
      yOffset: -2,
    });
    useStore.getState().updateGlobalCompressionAnnotation(compressionId!, {
      tick: 3,
      style: { stroke: '#ff0000', strokeWidth: 2 },
    });
    expect(useStore.getState().diagram.annotations).toEqual([
      expect.objectContaining({ id: verticalId, type: 'vertical-line', tick: 4 }),
      expect.objectContaining({
        id: horizontalId,
        type: 'horizontal-line',
        yOffset: -2,
      }),
      expect.objectContaining({
        id: compressionId,
        type: 'global-compression',
        tick: 3,
        style: { stroke: '#ff0000', strokeWidth: 2 },
      }),
    ]);
  });
});
