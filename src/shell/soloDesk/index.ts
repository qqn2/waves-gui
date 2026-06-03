/**
 * Browser draft recovery — NOT a substitute for File → Save.
 *
 * localDraft.ts  — autosave DiagramState to localStorage on change
 * recentFiles.ts — remember last opened filenames (names only, not file contents)
 * safeStorage.ts — localStorage wrapper with quota handling
 */
export {
  clearDraft,
  DRAFT_ENVELOPE_VERSION,
  DRAFT_STORAGE_KEY,
  isDiagramEmpty,
  loadDraft,
  saveDraft,
  serializeDraftEnvelope,
} from './localDraft';
export type { DraftEnvelope, StorageLike } from './localDraft';

export {
  clearRecentFiles,
  loadRecentFiles,
  RECENT_FILES_ENVELOPE_VERSION,
  RECENT_FILES_MAX,
  RECENT_FILES_STORAGE_KEY,
  recordRecentFile,
} from './recentFiles';
export type { RecentFileEntry } from './recentFiles';

export { useSoloDeskPersistence } from './useSoloDeskPersistence';
