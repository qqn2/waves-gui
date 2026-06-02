import { useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useStore } from '../../shared/store';
import { clearDraft, isDiagramEmpty, loadDraft, saveDraft } from './localDraft';

const DRAFT_DEBOUNCE_MS = 1000;

const RESTORE_CONFIRM_MESSAGE =
  'An unsaved draft was found. Restore it and replace the current diagram?';

/**
 * Autosaves diagram drafts, offers restore on mount, and guards tab close when dirty.
 *
 * Call {@link recordRecentFile} from FileOperations after a successful open or save.
 */
export function useSoloDeskPersistence(): void {
  const diagram = useStore((s) => s.diagram);
  const loadDiagram = useStore((s) => s.loadDiagram);
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
        const current = useStore.getState().diagram;
        const shouldRestore =
          isDiagramEmpty(current) || window.confirm(RESTORE_CONFIRM_MESSAGE);
        if (shouldRestore) {
          loadDiagram(draft);
        }
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
  }, [loadDiagram]);

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
