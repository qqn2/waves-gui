import { getSafeStorage, type StorageLike } from './safeStorage';

export { type StorageLike } from './safeStorage';

export const RECENT_FILES_STORAGE_KEY = 'wavedrom-gui-recent-files';

export const RECENT_FILES_MAX = 5;

export const RECENT_FILES_ENVELOPE_VERSION = 1 as const;

export interface RecentFileEntry {
  name: string;
  openedAt: number;
}

interface RecentFilesEnvelope {
  version: typeof RECENT_FILES_ENVELOPE_VERSION;
  files: RecentFileEntry[];
}

function isRecentFilesEnvelope(value: unknown): value is RecentFilesEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.version !== RECENT_FILES_ENVELOPE_VERSION) {
    return false;
  }
  if (!Array.isArray(record.files)) {
    return false;
  }
  return record.files.every(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as RecentFileEntry).name === 'string' &&
      typeof (entry as RecentFileEntry).openedAt === 'number',
  );
}

export function loadRecentFiles(
  storage: StorageLike = getSafeStorage(),
): RecentFileEntry[] {
  try {
    const raw = storage.getItem(RECENT_FILES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecentFilesEnvelope(parsed)) {
      return [];
    }
    return parsed.files;
  } catch (err) {
    console.warn('[soloDesk] loadRecentFiles failed', err);
    return [];
  }
}

export function recordRecentFile(
  name: string,
  storage: StorageLike = getSafeStorage(),
  openedAt = Date.now(),
): void {
  const trimmed = name.trim();
  if (!trimmed) {
    return;
  }

  try {
    const withoutDuplicate = loadRecentFiles(storage).filter(
      (entry) => entry.name !== trimmed,
    );
    const files: RecentFileEntry[] = [
      { name: trimmed, openedAt },
      ...withoutDuplicate,
    ].slice(0, RECENT_FILES_MAX);

    const envelope: RecentFilesEnvelope = {
      version: RECENT_FILES_ENVELOPE_VERSION,
      files,
    };
    storage.setItem(RECENT_FILES_STORAGE_KEY, JSON.stringify(envelope));
  } catch (err) {
    console.warn('[soloDesk] recordRecentFile failed', err);
  }
}

export function clearRecentFiles(storage: StorageLike = getSafeStorage()): void {
  try {
    storage.removeItem(RECENT_FILES_STORAGE_KEY);
  } catch (err) {
    console.warn('[soloDesk] clearRecentFiles failed', err);
  }
}
