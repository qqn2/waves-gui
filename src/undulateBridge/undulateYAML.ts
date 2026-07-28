import {
  isAlias,
  isMap,
  isScalar,
  parseDocument,
  stringify,
  visit,
} from 'yaml';
import type {
  WdGroup,
  WdSignal,
  WdSignalEntry,
} from '../wavedromBridge';
import type { UndulateRoot } from './types';

export const MAX_UNDULATE_YAML_BYTES = 1_000_000;
export const MAX_UNDULATE_YAML_NODES = 50_000;
export const MAX_UNDULATE_YAML_DEPTH = 64;

const ROOT_METADATA = new Set([
  'config',
  'head',
  'foot',
  'edge',
  'edges',
  'annotations',
  'reg',
  'register',
]);
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function yamlError(message: string): Error {
  return new Error(`Invalid Undulate YAML: ${message}`);
}

function assertSafeJSONValue(
  value: unknown,
  depth = 0,
  path = 'root',
): void {
  if (depth > MAX_UNDULATE_YAML_DEPTH) {
    throw yamlError(`document nesting exceeds ${MAX_UNDULATE_YAML_DEPTH} levels`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertSafeJSONValue(item, depth + 1, `${path}[${index}]`)
    );
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(key)) throw yamlError(`unsafe mapping key at ${path}.${key}`);
    if (key === '<<') throw yamlError('merge keys are not supported');
    assertSafeJSONValue(item, depth + 1, `${path}.${key}`);
  }
}

function normalizeYamlAnnotationAnchors(value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const annotation of value) {
    if (!isRecord(annotation)) continue;
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

function yamlSignalEntry(name: string, value: unknown): WdSignalEntry {
  if (!isRecord(value)) {
    throw yamlError(`signal or group ${JSON.stringify(name)} must be a mapping`);
  }
  if (Object.keys(value).length === 0) return {};
  if (Object.prototype.hasOwnProperty.call(value, 'wave')) {
    return {
      ...value,
      name,
    } as WdSignal;
  }
  return [
    name,
    ...Object.entries(value).map(([childName, child]) =>
      yamlSignalEntry(childName, child)
    ),
  ] as WdGroup;
}

function yamlObjectToRoot(value: unknown): UndulateRoot {
  if (!isRecord(value)) throw yamlError('root must be a mapping');
  if (Array.isArray(value.signal)) {
    normalizeYamlAnnotationAnchors(value.annotations);
    return value as unknown as UndulateRoot;
  }

  const root: Record<string, unknown> = { signal: [] };
  const signals = root.signal as WdSignalEntry[];
  for (const [key, item] of Object.entries(value)) {
    if (ROOT_METADATA.has(key)) {
      root[key] = item;
    } else {
      signals.push(yamlSignalEntry(key, item));
    }
  }
  normalizeYamlAnnotationAnchors(root.annotations);
  return root as unknown as UndulateRoot;
}

export function parseUndulateYAML(source: string): UndulateRoot {
  if (new TextEncoder().encode(source).length > MAX_UNDULATE_YAML_BYTES) {
    throw yamlError(`file exceeds ${MAX_UNDULATE_YAML_BYTES} bytes`);
  }
  const document = parseDocument(source, {
    version: '1.2',
    schema: 'core',
    strict: true,
    stringKeys: true,
    uniqueKeys: true,
    prettyErrors: true,
  });
  if (document.errors.length > 0) {
    throw yamlError(document.errors[0]!.message.split('\n', 1)[0]!);
  }

  let nodeCount = 0;
  visit(document, {
    Node(_key, node, path) {
      nodeCount++;
      if (nodeCount > MAX_UNDULATE_YAML_NODES) {
        throw yamlError(`document exceeds ${MAX_UNDULATE_YAML_NODES} nodes`);
      }
      if (path.length > MAX_UNDULATE_YAML_DEPTH * 2) {
        throw yamlError(`document nesting exceeds ${MAX_UNDULATE_YAML_DEPTH} levels`);
      }
      if (isAlias(node)) throw yamlError('aliases and anchors are not supported');
      if ('anchor' in node && node.anchor) {
        throw yamlError('aliases and anchors are not supported');
      }
      if ('tag' in node && node.tag) throw yamlError('explicit tags are not supported');
      if (isMap(node)) {
        for (const pair of node.items) {
          if (isScalar(pair.key) && pair.key.value === '<<') {
            throw yamlError('merge keys are not supported');
          }
        }
      }
    },
  });

  const value = document.toJS({ maxAliasCount: 0 }) as unknown;
  assertSafeJSONValue(value);
  return yamlObjectToRoot(value);
}

function signalMapping(
  entries: WdSignalEntry[],
  reserved: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
  const mapping: Record<string, unknown> = {};
  let spacerIndex = 0;
  for (const entry of entries) {
    if (Array.isArray(entry)) {
      const name = String(entry[0] ?? '');
      if (!name) throw yamlError('groups require a non-empty name');
      if (reserved.has(name) || Object.prototype.hasOwnProperty.call(mapping, name)) {
        throw yamlError(`duplicate or reserved signal/group name ${JSON.stringify(name)}`);
      }
      mapping[name] = signalMapping(entry.slice(1) as WdSignalEntry[]);
      continue;
    }
    const signal = entry as WdSignal;
    const rawName = typeof signal.name === 'string' ? signal.name : '';
    let name = rawName;
    if (!name) {
      do {
        name = `spacer_${spacerIndex++}`;
      } while (
        reserved.has(name)
        || Object.prototype.hasOwnProperty.call(mapping, name)
      );
    }
    if (
      UNSAFE_KEYS.has(name)
      || reserved.has(name)
      || Object.prototype.hasOwnProperty.call(mapping, name)
    ) {
      throw yamlError(`duplicate, unsafe, or reserved signal name ${JSON.stringify(name)}`);
    }
    const properties: Record<string, unknown> = { ...signal };
    delete properties.name;
    mapping[name] =
      !rawName
      && Object.keys(properties).length === 1
      && properties.wave === ''
        ? {}
        : properties;
  }
  return mapping;
}

export function undulateRootToYAMLObject(
  root: UndulateRoot,
): Record<string, unknown> {
  const result = signalMapping(root.signal, ROOT_METADATA);
  for (const [key, value] of Object.entries(root)) {
    if (key !== 'signal' && value !== undefined) result[key] = value;
  }
  return result;
}

export function stringifyUndulateYAML(root: UndulateRoot): string {
  return stringify(undulateRootToYAMLObject(root), {
    version: '1.2',
    schema: 'core',
    indent: 2,
    lineWidth: 0,
    sortMapEntries: false,
  });
}
