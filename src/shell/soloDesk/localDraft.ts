import type { DiagramState } from '../../shared/types';
import { normalizeDiagram } from '../../shared/normalizeDiagram';
import { getSafeStorage, type StorageLike } from './safeStorage';

export { type StorageLike } from './safeStorage';

export const DRAFT_STORAGE_KEY = 'wavedrom-gui-draft';

export const DRAFT_ENVELOPE_VERSION = 1 as const;

export interface DraftEnvelope {
  version: typeof DRAFT_ENVELOPE_VERSION;
  savedAt: number;
  diagram: DiagramState;
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
  storage: StorageLike = getSafeStorage(),
): void {
  try {
    const envelope: DraftEnvelope = {
      version: DRAFT_ENVELOPE_VERSION,
      savedAt: Date.now(),
      diagram: normalizeDiagram(diagram),
    };
    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(envelope));
  } catch (err) {
    console.warn('[soloDesk] saveDraft failed', err);
  }
}

export function loadDraft(storage: StorageLike = getSafeStorage()): DiagramState | null {
  try {
    const raw = storage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isDraftEnvelope(parsed)) {
      return null;
    }
    return normalizeDiagram(parsed.diagram);
  } catch (err) {
    console.warn('[soloDesk] loadDraft failed', err);
    return null;
  }
}

export function clearDraft(storage: StorageLike = getSafeStorage()): void {
  try {
    storage.removeItem(DRAFT_STORAGE_KEY);
  } catch (err) {
    console.warn('[soloDesk] clearDraft failed', err);
  }
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
