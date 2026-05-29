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
