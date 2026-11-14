// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../../shared/store';
import { defaultView } from '../../shared/store/helpers';
import { fromWavedromJSON, toWavedromJSON } from '../../wavedromBridge';
import { pickBusLabelFromHit, selectedBusSegment } from '../../tools/busLabelPick';
import { registerCodeFlush } from '../../codePanel/flushRegistry';
import { commitPendingBusLabelDraft } from '../busLabelDraft';
import { ToolbarBusSection } from './ToolbarPaintSection';

function Fixture() {
  const view = useStore((state) => state.view);
  return <ToolbarBusSection mode={view.selectedTool === 'paint' ? 'paint' : 'edit'}
    activeBusLabel={view.activeBusLabel} activeBusColorIndex={view.activeBusColorIndex}
    onBusLabel={useStore.getState().setActiveBusLabel} onBusColorIndex={useStore.getState().setActiveBusColorIndex} />;
}

const fixture = () => fromWavedromJSON({ signal: [{ name: 'PWDATA', wave: 'x.=.=.x.', data: ['0x11', '0x22'] }] });

describe('selected bus toolbar editing', () => {
  let host: HTMLDivElement;
  let root: Root;
  let signalId: string;
  let unregisterFlush: (() => void) | undefined;
  beforeEach(async () => {
    const diagram = fixture();
    signalId = diagram.signals[0]!.id;
    useStore.setState({ diagram, savedDiagram: structuredClone(diagram), history: [], future: [],
      view: { ...defaultView(), selectedTool: 'cursor' } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<Fixture />));
  });
  afterEach(async () => {
    unregisterFlush?.();
    unregisterFlush = undefined;
    await act(async () => root.unmount());
    host.remove();
  });

  const input = () => host.querySelector<HTMLInputElement>('[aria-label="Bus label"]')!;
  const data = () => {
    const source = toWavedromJSON(useStore.getState().diagram);
    return (source.signal![0] as { data: string[] }).data;
  };
  async function select() {
    await act(async () => {
      useStore.getState().setActiveSignalIds([signalId]);
      pickBusLabelFromHit({ signalId, signalType: 'vector', step: 2, half: null,
        isLabelArea: false, isTimeAxis: false, edgeIndex: null, annotationId: null }, useStore.getState().diagram);
    });
  }
  async function type(value: string) {
    await act(async () => {
      input().focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value);
      input().dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  async function key(key: string) {
    await act(async () => input().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })));
  }

  it('requires an explicit span and edits only that span with one undo entry', async () => {
    expect(input().disabled).toBe(true);
    await act(async () => useStore.getState().setActiveSignalIds([signalId]));
    expect(input().disabled).toBe(true);
    await select();
    expect(input().value).toBe('0x11');
    await type('0x1234');
    expect(data()).toEqual(['0x11', '0x22']);
    await key('Enter');
    expect(data()).toEqual(['0x1234', '0x22']);
    expect(useStore.getState().history).toHaveLength(1);
    expect(useStore.getState().view.isDirty).toBe(true);
    await act(async () => useStore.getState().undo());
    expect(data()).toEqual(['0x11', '0x22']);
    expect(input().disabled).toBe(true);
    await act(async () => useStore.getState().redo());
    expect(data()).toEqual(['0x1234', '0x22']);
  });

  it('commits on blur and discards an Escape draft', async () => {
    await select();
    await type('discard');
    await key('Escape');
    expect(input().value).toBe('0x11');
    expect(useStore.getState().history).toHaveLength(0);
    await type('on blur');
    await act(async () => input().blur());
    expect(data()).toEqual(['on blur', '0x22']);
    expect(useStore.getState().history).toHaveLength(1);
  });

  it('flushes the focused draft before save snapshots', async () => {
    await select();
    await type('from save');
    await act(async () => { expect(commitPendingBusLabelDraft()).toBe(true); });
    expect(data()).toEqual(['from save', '0x22']);
    expect(useStore.getState().history).toHaveLength(1);
  });

  it('retains a rejected draft without altering the document', async () => {
    await select();
    await type('pending');
    unregisterFlush = registerCodeFlush(() => ({ ok: false, error: 'Invalid source' }));
    await act(async () => { expect(commitPendingBusLabelDraft()).toBe(false); });
    expect(input().value).toBe('pending');
    expect(data()).toEqual(['0x11', '0x22']);
    expect(useStore.getState().history).toHaveLength(0);
  });

  it('does not apply a draft to a document replaced by a source flush', async () => {
    await select();
    await type('stale');
    unregisterFlush = registerCodeFlush(() => { useStore.getState().loadDiagram(fixture()); });
    await act(async () => { expect(commitPendingBusLabelDraft()).toBe(false); });
    expect(data()).toEqual(['0x11', '0x22']);
    expect(input().disabled).toBe(true);
    expect(useStore.getState().view.activeBusSegment).toBeNull();
  });

  it('updates the selected span color while preserving the other span', async () => {
    await select();
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Bus color 4"]')!.click());
    const state = useStore.getState();
    expect(selectedBusSegment(state.diagram, state.view)?.segment.color).toBeTruthy();
    expect(toWavedromJSON(state.diagram).signal?.[0]).toMatchObject({ wave: 'x.4.=.x.', data: ['0x11', '0x22'] });
    expect(state.history).toHaveLength(1);
  });

  it('does not offer edits for opaque mixed bus/scalar source lanes', async () => {
    const diagram = fromWavedromJSON({ signal: [{ name: 'mixed', wave: '=01=', data: ['first', 'last'] }] });
    signalId = diagram.signals[0]!.id;
    await act(async () => {
      useStore.getState().loadDiagram(diagram);
      useStore.getState().setActiveSignalIds([signalId]);
      pickBusLabelFromHit({ signalId, signalType: 'vector', step: 0, half: null,
        isLabelArea: false, isTimeAxis: false, edgeIndex: null, annotationId: null }, useStore.getState().diagram);
    });
    expect(input().disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Bus color 4"]')!.disabled).toBe(true);
    expect(toWavedromJSON(useStore.getState().diagram).signal?.[0]).toMatchObject({ wave: '=01=', data: ['first', 'last'] });
  });

  it('keeps Draw labels as brush settings and clears stale selection on tool change', async () => {
    await select();
    await act(async () => useStore.getState().setTool('paint'));
    await type('brush');
    expect(useStore.getState().view.activeBusLabel).toBe('brush');
    expect(data()).toEqual(['0x11', '0x22']);
    expect(useStore.getState().history).toHaveLength(0);
    await act(async () => useStore.getState().setTool('cursor'));
    expect(input().disabled).toBe(true);
  });
});
