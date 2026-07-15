import { useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useStore } from '../../shared/store';
import { clearDraft, isDiagramEmpty, loadDraft, saveDraft } from './localDraft';

const DRAFT_DEBOUNCE_MS = 1000;

/**
 * Autosaves diagram drafts, restores the latest recovery state on mount, and guards tab close.
 *
 * Call {@link recordRecentFile} from FileOperations after a successful open or save.
 */
export function useSoloDeskPersistence(): void {
  const diagram = useStore((s) => s.diagram);
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
      if (draft) {
        if (isDiagramEmpty(draft)) {
          clearDraft();
        } else restoreDraft(draft);
      }
    } catch (err) {
      console.warn('[soloDesk] draft restore failed', err);
      try {
        clearDraft();
      } catch {
        /* storage may be unavailable */
      }
    }

    setAutosaveEnabled(true);
  }, [restoreDraft]);

  useEffect(() => {
    if (!autosaveEnabled) {
      return;
    }
    debouncedSave(diagram);
    return () => {
      debouncedSave.cancel();
    };
  }, [autosaveEnabled, diagram, debouncedSave]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!useStore.getState().view.isDirty) {
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
