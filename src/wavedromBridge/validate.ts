import type { WdRoot } from './wdTypes';

const WAVE_CHARS = /^[0-9.xXzZuUdDpPnN.=|2-9]*$/;

function isWdGroup(entry: unknown): entry is [string, ...unknown[]] {
  return Array.isArray(entry) && typeof entry[0] === 'string';
}

function validateSignalEntry(entry: unknown): string | null {
  if (entry === null || typeof entry !== 'object') {
    return 'Invalid signal entry';
  }
  if (isWdGroup(entry)) {
    for (const child of entry.slice(1)) {
      const err = validateSignalEntry(child);
      if (err) return err;
    }
    return null;
  }
  if (Object.keys(entry).length === 0) return null;
  const sig = entry as { wave?: string };
  if (sig.wave !== undefined) {
    if (typeof sig.wave !== 'string') return 'wave must be a string';
    if (!WAVE_CHARS.test(sig.wave)) {
      return `Invalid wave characters: ${sig.wave}`;
    }
  }
  return null;
}

/** Returns null if valid, or an error message string */
export function validateWavedromJSON(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) {
    return 'Root must be an object';
  }
  const root = json as WdRoot;
  if (!Array.isArray(root.signal)) {
    return 'Missing or invalid signal array';
  }
  for (const entry of root.signal) {
    const err = validateSignalEntry(entry);
    if (err) return err;
  }
  if (root.config?.hscale !== undefined) {
    const h = root.config.hscale;
    if (typeof h !== 'number' || h < 1 || h > 4) {
      return 'config.hscale must be 1–4';
    }
  }
  return null;
}
