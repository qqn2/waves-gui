import type { DiagramState } from '../../shared/types';

export const DRAFT_STORAGE_KEY = 'wavedrom-gui-draft';

export const DRAFT_ENVELOPE_VERSION = 1 as const;

export interface DraftEnvelope {
  version: typeof DRAFT_ENVELOPE_VERSION;
  savedAt: number;
  diagram: DiagramState;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike {
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  throw new Error('localStorage is not available');
}

export function isDiagramEmpty(diagram: DiagramState): boolean {
  return diagram.signals.length === 0 && diagram.annotations.length === 0;
}

function isDraftEnvelope(value: unknown): value is DraftEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.version !== DRAFT_ENVELOPE_VERSION) {
    return false;
  }
  if (typeof record.savedAt !== 'number') {
    return false;
  }
  if (typeof record.diagram !== 'object' || record.diagram === null) {
    return false;
  }
  const diagram = record.diagram as Record<string, unknown>;
  return (
    diagram.version === 1 &&
    Array.isArray(diagram.signals) &&
    typeof diagram.config === 'object' &&
    diagram.config !== null &&
    Array.isArray(diagram.annotations)
  );
}

export function saveDraft(
  diagram: DiagramState,
  storage: StorageLike = defaultStorage(),
): void {
  const envelope: DraftEnvelope = {
    version: DRAFT_ENVELOPE_VERSION,
    savedAt: Date.now(),
    diagram,
  };
  storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(envelope));
}

export function loadDraft(storage: StorageLike = defaultStorage()): DiagramState | null {
  const raw = storage.getItem(DRAFT_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isDraftEnvelope(parsed)) {
      return null;
    }
    return parsed.diagram;
  } catch {
    return null;
  }
}

export function clearDraft(storage: StorageLike = defaultStorage()): void {
  storage.removeItem(DRAFT_STORAGE_KEY);
}

/** Serialize draft envelope for tests and debugging. */
export function serializeDraftEnvelope(diagram: DiagramState, savedAt = 0): string {
  const envelope: DraftEnvelope = {
    version: DRAFT_ENVELOPE_VERSION,
    savedAt,
    diagram,
  };
  return JSON.stringify(envelope);
}
