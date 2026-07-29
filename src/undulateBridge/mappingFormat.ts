import type {
  WdGroup,
  WdSignal,
  WdSignalEntry,
} from '../wavedromBridge';
import type { UndulateRoot } from './types';

export const UNDULATE_MAPPING_ROOT_METADATA = new Set([
  'config',
  'head',
  'foot',
  'edge',
  'edges',
  'annotations',
  'reg',
  'register',
]);
export const UNSAFE_MAPPING_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

export function isMappingRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeAnnotationAnchors(value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const annotation of value) {
    if (!isMappingRecord(annotation)) continue;
    for (const field of ['from', 'to']) {
      const anchor = annotation[field];
      if (typeof anchor !== 'string') continue;
      const match = anchor.trim().match(
        /^\(\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\)$/,
      );
      if (match) annotation[field] = [Number(match[1]), Number(match[2])];
    }
  }
}

function mappingSignalEntry(
  name: string,
  value: unknown,
  invalid: (message: string) => Error,
): WdSignalEntry {
  if (!isMappingRecord(value)) {
    throw invalid(`signal or group ${JSON.stringify(name)} must be a mapping`);
  }
  if (
    typeof value.name === 'string'
    && isMappingRecord(value.signal)
  ) {
    return [
      value.name,
      ...Object.entries(value.signal).map(([childName, child]) =>
        mappingSignalEntry(childName, child, invalid)
      ),
    ] as WdGroup;
  }
  if (Object.keys(value).length === 0) return {};
  if (Object.prototype.hasOwnProperty.call(value, 'wave')) {
    const explicitName =
      typeof value.name === 'string' ? value.name : name;
    return { ...value, name: explicitName } as WdSignal;
  }
  return [
    name,
    ...Object.entries(value).map(([childName, child]) =>
      mappingSignalEntry(childName, child, invalid)
    ),
  ] as WdGroup;
}

export function undulateMappingToRoot(
  value: unknown,
  invalid: (message: string) => Error,
): UndulateRoot {
  if (!isMappingRecord(value)) throw invalid('root must be a mapping');
  if (Array.isArray(value.signal)) {
    normalizeAnnotationAnchors(value.annotations);
    return value as unknown as UndulateRoot;
  }
  const root: Record<string, unknown> = { signal: [] };
  const signals = root.signal as WdSignalEntry[];
  for (const [key, item] of Object.entries(value)) {
    if (UNDULATE_MAPPING_ROOT_METADATA.has(key)) {
      root[key] = item;
    } else {
      signals.push(mappingSignalEntry(key, item, invalid));
    }
  }
  normalizeAnnotationAnchors(root.annotations);
  return root as unknown as UndulateRoot;
}

function signalMapping(
  entries: WdSignalEntry[],
  invalid: (message: string) => Error,
  reserved: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
  const mapping: Record<string, unknown> = {};
  let spacerIndex = 0;
  let signalIndex = 0;
  let groupIndex = 0;
  for (const entry of entries) {
    if (Array.isArray(entry)) {
      const rawName = String(entry[0] ?? '');
      let name = rawName;
      const needsAlias =
        !name
        || UNSAFE_MAPPING_KEYS.has(name)
        || reserved.has(name)
        || Object.prototype.hasOwnProperty.call(mapping, name);
      if (needsAlias) {
        do {
          name = `group_${groupIndex++}`;
        } while (
          UNSAFE_MAPPING_KEYS.has(name)
          || reserved.has(name)
          || Object.prototype.hasOwnProperty.call(mapping, name)
        );
      }
      const children = signalMapping(
        entry.slice(1) as WdSignalEntry[],
        invalid,
      );
      mapping[name] = needsAlias
        ? { name: rawName, signal: children }
        : children;
      continue;
    }
    const signal = entry as WdSignal;
    const hasExplicitName = typeof signal.name === 'string';
    const rawName = hasExplicitName ? signal.name! : '';
    let name = rawName;
    if (!name) {
      do {
        name = `spacer_${spacerIndex++}`;
      } while (
        reserved.has(name)
        || Object.prototype.hasOwnProperty.call(mapping, name)
      );
    }
    const needsAlias =
      UNSAFE_MAPPING_KEYS.has(name)
      || reserved.has(name)
      || Object.prototype.hasOwnProperty.call(mapping, name);
    if (needsAlias) {
      do {
        name = `signal_${signalIndex++}`;
      } while (
        UNSAFE_MAPPING_KEYS.has(name)
        || reserved.has(name)
        || Object.prototype.hasOwnProperty.call(mapping, name)
      );
    }
    const properties: Record<string, unknown> = { ...signal };
    delete properties.name;
    const spacerLike =
      hasExplicitName
      && rawName === ''
      && Object.keys(properties).length === 1
      && properties.wave === '';
    if (!spacerLike && hasExplicitName && name !== rawName) {
      properties.name = rawName;
    }
    mapping[name] =
      spacerLike
      || (!hasExplicitName && Object.keys(properties).length === 0)
        ? {}
        : properties;
  }
  return mapping;
}

export function undulateRootToMapping(
  root: UndulateRoot,
  invalid: (message: string) => Error,
): Record<string, unknown> {
  const reserved = new Set(UNDULATE_MAPPING_ROOT_METADATA);
  for (const key of Object.keys(root)) {
    if (key !== 'signal') reserved.add(key);
  }
  const result = signalMapping(
    root.signal,
    invalid,
    reserved,
  );
  for (const [key, value] of Object.entries(root)) {
    if (key !== 'signal' && value !== undefined) result[key] = value;
  }
  return result;
}
