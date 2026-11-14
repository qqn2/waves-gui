// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../../shared/store';
import { defaultDiagram, defaultView } from '../../shared/store/helpers';
import { DRAFT_STORAGE_KEY, saveDraft, loadDraftEnvelope } from './localDraft';
import { RecoveryStatus } from './RecoveryStatus';
import { useRecoveryStatus } from './recoveryStatus';
import { useSoloDeskPersistence } from './useSoloDeskPersistence';

vi.mock('./safeStorage', () => ({
  getSafeStorage: () => localStorage,
  isBrowserStoragePersistent: () => true,
}));

function Harness() {
  useSoloDeskPersistence();
  return <RecoveryStatus />;
}

describe('browser recovery status', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    const diagram = defaultDiagram();
    useStore.setState({ diagram, savedDiagram: diagram, view: defaultView(), history: [], future: [] });
    useRecoveryStatus.setState({ status: 'pending', savedAt: null, restored: false });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('shows pending then browser-saved without marking the file clean', async () => {
    await act(async () => root.render(<Harness />));
    await act(async () => { useStore.getState().addSignal('bit'); });
    expect(host.textContent).toContain('Saving recovery…');
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(host.textContent).toContain('Recovery saved in browser');
    expect(useStore.getState().view.isDirty).toBe(true);
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull();
  });

  it('flushes the newest diagram and raw source when the page is hidden', async () => {
    await act(async () => root.render(<Harness />));
    await act(async () => {
      useStore.getState().addSignal('bit');
      useStore.getState().setSourceDraftStatus(true, 'Incomplete', '{ signal: [');
      useStore.setState((state) => { state.view.fileName = 'draft.json'; });
    });
    await act(async () => { window.dispatchEvent(new Event('pagehide')); });
    const envelope = loadDraftEnvelope(localStorage);
    expect(envelope?.diagram.signals).toHaveLength(useStore.getState().diagram.signals.length);
    expect(envelope).toMatchObject({ fileName: 'draft.json', source: { code: '{ signal: [' } });
    expect(host.textContent).toContain('Recovery saved in browser');
  });

  it('restores the filename and invalid source and shows a dismissible notice', async () => {
    saveDraft(defaultDiagram(), localStorage, {
      fileName: 'recovered.json',
      source: { version: 1, savedAt: 10, code: '{ signal: [', error: 'Incomplete' },
    });
    await act(async () => root.render(<Harness />));
    expect(useStore.getState().view.fileName).toBe('recovered.json');
    expect(useStore.getState().view.sourceDraft).toBe('{ signal: [');
    expect(useStore.getState().view.sourceDraftDirty).toBe(true);
    expect(host.textContent).toContain('Restored browser draft');
    await act(async () => { host.querySelector('button')!.click(); });
    expect(host.textContent).not.toContain('Restored browser draft');
  });

  it('reports a failed recovery write without claiming the work was saved', async () => {
    await act(async () => root.render(<Harness />));
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(host.textContent).toContain('Recovery unavailable — save a file');
    expect(host.textContent).not.toContain('Recovery saved in browser');
  });
});
