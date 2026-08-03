import type { WdRoot } from './wdTypes';
import { isValidWaveString } from './subcycleWave';
import { MAX_TOTAL_STEPS } from '../shared/constants';

const WAVEDROM_WAVE_CHARS = /^[0-9.xXzZuUdDpPnN.=|2-9<>]*$/;
const UNDULATE_WAVE_CHARS = /^[0-9.xXzZuUdDpPnNiImMhHlL.=|2-9<>]*$/;
const MAX_SIGNAL_ENTRIES = 512;
const MAX_GROUP_DEPTH = 32;
const MAX_WAVE_LENGTH = 16_384;
const MAX_DATA_ENTRIES = 16_384;

export interface WavedromValidationOptions {
  allowUndulateDigitalStates?: boolean;
}

function isWdGroup(entry: unknown): entry is [string, ...unknown[]] {
  return Array.isArray(entry) && typeof entry[0] === 'string';
}

function validateSignalEntry(
  entry: unknown,
  options: WavedromValidationOptions,
  depth: number,
  counter: { count: number },
): string | null {
  if (depth > MAX_GROUP_DEPTH) return `Signal nesting exceeds ${MAX_GROUP_DEPTH} levels`;
  if (entry === null || typeof entry !== 'object') {
    return 'Invalid signal entry';
  }
  if (isWdGroup(entry)) {
    counter.count += 1;
    for (const child of entry.slice(1)) {
      const err = validateSignalEntry(child, options, depth + 1, counter);
      if (err) return err;
    }
    return null;
  }
  if (Object.keys(entry).length === 0) return null;
  counter.count += 1;
  if (counter.count > MAX_SIGNAL_ENTRIES) {
    return `Document contains more than ${MAX_SIGNAL_ENTRIES} signal entries`;
  }
  const sig = entry as {
    name?: unknown;
    wave?: unknown;
    data?: unknown;
    node?: unknown;
    phase?: unknown;
    period?: unknown;
    periods?: unknown;
    duty_cycle?: unknown;
    duty_cycles?: unknown;
    slewing?: unknown;
  };
  if (sig.name !== undefined && typeof sig.name !== 'string') return 'signal name must be a string';
  if (sig.node !== undefined && typeof sig.node !== 'string') return 'node must be a string';
  for (const [key, value] of [
    ['phase', sig.phase], ['period', sig.period], ['duty_cycle', sig.duty_cycle], ['slewing', sig.slewing],
  ] as const) {
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
      return `${key} must be a finite number`;
    }
  }
  if (sig.period !== undefined && (sig.period as number) <= 0) return 'period must be positive';
  if (sig.duty_cycle !== undefined && ((sig.duty_cycle as number) < 0 || (sig.duty_cycle as number) > 1)) {
    return 'duty_cycle must be between 0 and 1';
  }
  for (const [key, value] of [['periods', sig.periods], ['duty_cycles', sig.duty_cycles]] as const) {
    if (value !== undefined && (!Array.isArray(value) || value.length > MAX_WAVE_LENGTH || value.some((n) => typeof n !== 'number' || !Number.isFinite(n)))) {
      return `${key} must be a finite numeric array`;
    }
  }
  if (sig.wave !== undefined) {
    if (typeof sig.wave !== 'string') return 'wave must be a string';
    if (sig.wave.length > MAX_WAVE_LENGTH) return `wave exceeds ${MAX_WAVE_LENGTH} cells`;
    const waveChars = options.allowUndulateDigitalStates
      ? UNDULATE_WAVE_CHARS
      : WAVEDROM_WAVE_CHARS;
    if (!waveChars.test(sig.wave)) {
      return `Invalid wave characters: ${sig.wave}`;
    }
    if (!isValidWaveString(sig.wave)) {
      return `Invalid wave syntax: ${sig.wave}`;
    }
    const period = typeof sig.period === 'number' && sig.period > 0 ? sig.period : 1;
    const periods = Array.isArray(sig.periods) && sig.periods.length > 0
      ? sig.periods.reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0)
      : sig.wave.length * period;
    if (periods > MAX_TOTAL_STEPS) {
      return `wave expands beyond the ${MAX_TOTAL_STEPS}-step document limit`;
    }
  }
  if (sig.data !== undefined) {
    const data = sig.data;
    const valid = typeof data === 'string'
      || (Array.isArray(data)
        && data.length <= MAX_DATA_ENTRIES
        && data.every((entry) => typeof entry === 'string' || (Array.isArray(entry) && entry.every((part) => typeof part === 'string'))));
    if (!valid) return 'data must be a string or an array of strings';
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
  if (root.signal.length > MAX_SIGNAL_ENTRIES) {
    return `Document contains more than ${MAX_SIGNAL_ENTRIES} signal entries`;
  }
  const counter = { count: 0 };
  for (const entry of root.signal) {
    const err = validateSignalEntry(entry, options, 0, counter);
    if (err) return err;
  }
  if (root.edge !== undefined && (!Array.isArray(root.edge) || root.edge.length > MAX_DATA_ENTRIES || root.edge.some((edge) => typeof edge !== 'string'))) {
    return 'edge must be an array of strings';
  }
  if (root.config?.hscale !== undefined) {
    const h = root.config.hscale;
    if (typeof h !== 'number' || !Number.isFinite(h) || h < 1 || h > 4) {
      return 'config.hscale must be a number from 1 to 4';
    }
  }
  return null;
}
