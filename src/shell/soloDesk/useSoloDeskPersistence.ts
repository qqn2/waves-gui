import { useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useStore } from '../../shared/store';
import {
  clearSourceDraft,
  loadDraftEnvelope,
  loadSourceDraft,
  saveDraft,
} from './localDraft';
import { getSafeStorage, isBrowserStoragePersistent } from './safeStorage';
import { useRecoveryStatus } from './recoveryStatus';

const DRAFT_DEBOUNCE_MS = 1000;

/** Save one coherent snapshot, so raw source can never be restored with another diagram. */
export function saveCurrentRecoveryDraft(): void {
  const { diagram, view } = useStore.getState();
  const savedAt = Date.now();
  const wroteDraft = saveDraft(diagram, getSafeStorage(), {
    fileName: view.fileName,
    source: view.sourceDraft !== null && view.sourceDraft !== undefined
      ? {
        version: 1,
        savedAt,
        code: view.sourceDraft,
        error: view.sourceDraftError ?? null,
      }
      : null,
  });
  // New envelopes carry both diagram and source atomically; retire the old split key.
  if (wroteDraft && isBrowserStoragePersistent()) clearSourceDraft();
  useRecoveryStatus.setState({
    status: wroteDraft && isBrowserStoragePersistent() ? 'saved' : 'unavailable',
    savedAt: wroteDraft && isBrowserStoragePersistent() ? savedAt : null,
  });
}

/** Autosave locally, restore a browser draft, and guard unsaved files on tab close. */
export function useSoloDeskPersistence(): void {
  const diagram = useStore((s) => s.diagram);
  const fileName = useStore((s) => s.view.fileName);
  const isDirty = useStore((s) => s.view.isDirty);
  const sourceDraft = useStore((s) => s.view.sourceDraft);
  const sourceDraftError = useStore((s) => s.view.sourceDraftError ?? null);
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const restoreCheckedRef = useRef(false);
  const debouncedSave = useDebouncedCallback(saveCurrentRecoveryDraft, DRAFT_DEBOUNCE_MS);

  useEffect(() => {
    if (restoreCheckedRef.current) return;
    restoreCheckedRef.current = true;

    const draft = loadDraftEnvelope();
    // Older versions saved source separately. A new envelope's explicit null
    // suppresses any legacy key left behind by an interrupted migration.
    const source = draft && 'source' in draft ? draft.source : loadSourceDraft();
    if (draft) {
      useStore.getState().restoreDraft(draft.diagram);
      useStore.setState((state) => { state.view.fileName = draft.fileName ?? null; });
    }
    if (source) {
      useStore.getState().setSourceDraftStatus(true, source.error ?? null, source.code);
    }
    useRecoveryStatus.setState({
      status: isBrowserStoragePersistent() ? 'pending' : 'unavailable',
      savedAt: draft?.savedAt ?? null,
      restored: Boolean(draft || source),
    });
    setAutosaveEnabled(true);
  }, []);

  useEffect(() => {
    if (!autosaveEnabled) return;
    useRecoveryStatus.setState({
      status: isBrowserStoragePersistent() ? 'pending' : 'unavailable',
    });
    debouncedSave();
    return () => { debouncedSave.cancel(); };
  }, [autosaveEnabled, diagram, fileName, isDirty, sourceDraft, sourceDraftError, debouncedSave]);

  useEffect(() => {
    const flushRecovery = () => {
      if (!restoreCheckedRef.current) return;
      debouncedSave.cancel();
      saveCurrentRecoveryDraft();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushRecovery();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      flushRecovery();
      const { view } = useStore.getState();
      if (!view.isDirty && !view.sourceDraftDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('pagehide', flushRecovery);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', flushRecovery);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [debouncedSave]);
}

export { recordRecentFile } from './recentFiles';
