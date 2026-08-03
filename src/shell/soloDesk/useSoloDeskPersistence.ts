import { useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useStore } from '../../shared/store';
import {
  clearDraft,
  clearSourceDraft,
  isDiagramEmpty,
  loadDraft,
  loadSourceDraft,
  saveDraft,
  saveSourceDraft,
} from './localDraft';

const DRAFT_DEBOUNCE_MS = 1000;

/**
 * Autosaves diagram drafts, restores the latest recovery state on mount, and guards tab close.
 *
 * Call {@link recordRecentFile} from FileOperations after a successful open or save.
 */
export function useSoloDeskPersistence(): void {
  const diagram = useStore((s) => s.diagram);
  const sourceDraft = useStore((s) => s.view.sourceDraft);
  const sourceDraftError = useStore((s) => s.view.sourceDraftError ?? null);
  const setSourceDraftStatus = useStore((s) => s.setSourceDraftStatus);
  const restoreDraft = useStore((s) => s.restoreDraft);
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const restoreCheckedRef = useRef(false);

  const debouncedSave = useDebouncedCallback((nextDiagram: typeof diagram) => {
    saveDraft(nextDiagram);
  }, DRAFT_DEBOUNCE_MS);

  useEffect(() => {
    if (restoreCheckedRef.current) {
      return;
    }
    restoreCheckedRef.current = true;

    try {
      const draft = loadDraft();
      const source = loadSourceDraft();
      if (draft) {
        if (isDiagramEmpty(draft)) {
          clearDraft();
        } else restoreDraft(draft);
      }
      if (source) setSourceDraftStatus(true, source.error ?? null, source.code);
    } catch (err) {
      console.warn('[soloDesk] draft restore failed', err);
      try {
        clearDraft();
      } catch {
        /* storage may be unavailable */
      }
    }

    setAutosaveEnabled(true);
  }, [restoreDraft, setSourceDraftStatus]);

  useEffect(() => {
    if (!autosaveEnabled) {
      return;
    }
    debouncedSave(diagram);
    if (sourceDraft !== null && sourceDraft !== undefined) {
      saveSourceDraft(sourceDraft, sourceDraftError);
    } else clearSourceDraft();
    return () => {
      debouncedSave.cancel();
    };
  }, [autosaveEnabled, diagram, debouncedSave, sourceDraft, sourceDraftError]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const { view } = useStore.getState();
      if (!view.isDirty && !view.sourceDraftDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);
}

export { recordRecentFile } from './recentFiles';
