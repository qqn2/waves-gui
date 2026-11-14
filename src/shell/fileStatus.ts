import { create } from 'zustand';
import { useStore } from '../shared/store';

interface FileStatus {
  phase: 'idle' | 'saving' | 'download-requested' | 'error';
  confirmedFileName: string | null;
  error: string | null;
}

/** Disk writes and browser recovery are separate promises to the user. */
export const useFileStatus = create<FileStatus>(() => ({
  phase: 'idle',
  confirmedFileName: null,
  error: null,
}));

export function resetFileStatus(): void {
  useFileStatus.setState({ phase: 'idle', confirmedFileName: null, error: null });
}

useStore.subscribe((state, previous) => {
  if (
    useFileStatus.getState().phase === 'download-requested'
    && (state.diagram !== previous.diagram || state.view.sourceDraft !== previous.view.sourceDraft)
  ) {
    useFileStatus.setState({ phase: 'idle' });
  }
});
