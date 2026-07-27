import type { WdRoot } from './wdTypes';
import { isValidWaveString } from './subcycleWave';

const WAVEDROM_WAVE_CHARS = /^[0-9.xXzZuUdDpPnN.=|2-9<>]*$/;
const UNDULATE_WAVE_CHARS = /^[0-9.xXzZuUdDpPnNiImM.=|2-9<>]*$/;

export interface WavedromValidationOptions {
  allowUndulateDigitalStates?: boolean;
}

function isWdGroup(entry: unknown): entry is [string, ...unknown[]] {
  return Array.isArray(entry) && typeof entry[0] === 'string';
}

function validateSignalEntry(
  entry: unknown,
  options: WavedromValidationOptions,
): string | null {
  if (entry === null || typeof entry !== 'object') {
    return 'Invalid signal entry';
  }
  if (isWdGroup(entry)) {
    for (const child of entry.slice(1)) {
      const err = validateSignalEntry(child, options);
      if (err) return err;
    }
    return null;
  }
  if (Object.keys(entry).length === 0) return null;
  const sig = entry as { wave?: string };
  if (sig.wave !== undefined) {
    if (typeof sig.wave !== 'string') return 'wave must be a string';
    const waveChars = options.allowUndulateDigitalStates
      ? UNDULATE_WAVE_CHARS
      : WAVEDROM_WAVE_CHARS;
    if (!waveChars.test(sig.wave)) {
      return `Invalid wave characters: ${sig.wave}`;
    }
    if (!isValidWaveString(sig.wave)) {
      return `Invalid wave syntax: ${sig.wave}`;
    }
  }
  return null;
}

/** Returns null if valid, or an error message string */
export function validateWavedromJSON(
  json: unknown,
  options: WavedromValidationOptions = {},
): string | null {
  if (typeof json !== 'object' || json === null) {
    return 'Root must be an object';
  }
  const root = json as WdRoot;
  if (!Array.isArray(root.signal)) {
    return 'Missing or invalid signal array';
  }
  for (const entry of root.signal) {
    const err = validateSignalEntry(entry, options);
    if (err) return err;
  }
  if (root.config?.hscale !== undefined) {
    const h = root.config.hscale;
    if (typeof h !== 'number' || !Number.isFinite(h) || h < 1 || h > 4) {
      return 'config.hscale must be a number from 1 to 4';
    }
  }
  return null;
}
