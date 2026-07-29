import { parse, stringify } from 'smol-toml';
import type { UndulateRoot } from './types';
import {
  isMappingRecord,
  undulateMappingToRoot,
  undulateRootToMapping,
  UNSAFE_MAPPING_KEYS,
} from './mappingFormat';

export const MAX_UNDULATE_TOML_BYTES = 1_000_000;
export const MAX_UNDULATE_TOML_NODES = 50_000;
export const MAX_UNDULATE_TOML_DEPTH = 64;

function tomlError(message: string): Error {
  return new Error(`Invalid Undulate TOML: ${message}`);
}

function assertSafeTomlValue(
  value: unknown,
  counter: { nodes: number },
  depth = 0,
  path = 'root',
): void {
  counter.nodes++;
  if (counter.nodes > MAX_UNDULATE_TOML_NODES) {
    throw tomlError(`document exceeds ${MAX_UNDULATE_TOML_NODES} values`);
  }
  if (depth > MAX_UNDULATE_TOML_DEPTH) {
    throw tomlError(`document nesting exceeds ${MAX_UNDULATE_TOML_DEPTH} levels`);
  }
  if (value instanceof Date) {
    throw tomlError(`date/time values are not supported at ${path}`);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw tomlError(`non-finite numbers are not supported at ${path}`);
    }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw tomlError(`integer exceeds JavaScript's lossless range at ${path}`);
    }
    return;
  }
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertSafeTomlValue(item, counter, depth + 1, `${path}[${index}]`)
    );
    return;
  }
  if (!isMappingRecord(value)) {
    throw tomlError(`unsupported value at ${path}`);
  }
  for (const [key, item] of Object.entries(value)) {
    if (UNSAFE_MAPPING_KEYS.has(key)) {
      throw tomlError(`unsafe mapping key at ${path}.${key}`);
    }
    assertSafeTomlValue(item, counter, depth + 1, `${path}.${key}`);
  }
}

export function parseUndulateTOML(source: string): UndulateRoot {
  if (new TextEncoder().encode(source).length > MAX_UNDULATE_TOML_BYTES) {
    throw tomlError(`file exceeds ${MAX_UNDULATE_TOML_BYTES} bytes`);
  }
  let value: unknown;
  try {
    value = parse(source);
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message.split('\n', 1)[0]
        : 'unknown syntax error';
    throw tomlError(detail);
  }
  assertSafeTomlValue(value, { nodes: 0 });
  return undulateMappingToRoot(value, tomlError);
}

export function undulateRootToTOMLObject(
  root: UndulateRoot,
): Record<string, unknown> {
  const value = undulateRootToMapping(root, tomlError);
  assertSafeTomlValue(value, { nodes: 0 });
  return value;
}

export function stringifyUndulateTOML(root: UndulateRoot): string {
  try {
    return stringify(undulateRootToTOMLObject(root));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid Undulate TOML:')) {
      throw error;
    }
    const detail = error instanceof Error ? error.message : 'serialization failed';
    throw tomlError(detail);
  }
}

function tomlKeyPath(source: string): string[] | null {
  const keys: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;
  for (const char of source.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (quote === '"' && char === '\\') {
      current += char;
      escaped = true;
    } else if (quote) {
      current += char;
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === '.') {
      keys.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (quote || !current.trim()) return null;
  keys.push(current.trim());
  try {
    return keys.map((key) => {
      if (key.startsWith('"')) return JSON.parse(key) as string;
      if (key.startsWith("'") && key.endsWith("'")) return key.slice(1, -1);
      return key;
    });
  } catch {
    return null;
  }
}

function tomlSeparator(line: string, separator: '=' | '#'): number {
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let depth = 0;
  for (let index = 0; index < line.length; index++) {
    const char = line[index]!;
    if (escaped) {
      escaped = false;
    } else if (quote === '"' && char === '\\') {
      escaped = true;
    } else if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '[' || char === '{') {
      depth++;
    } else if (char === ']' || char === '}') {
      depth = Math.max(0, depth - 1);
    } else if (char === separator && (separator === '=' || depth === 0)) {
      return index;
    }
  }
  return -1;
}

function valueAtPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isMappingRecord(current) || !Object.prototype.hasOwnProperty.call(current, key)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function sameTomlValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function serializedTomlValue(value: unknown, previous: string): string | null {
  if (
    value === null
    || typeof value === 'object' && !Array.isArray(value)
    || Array.isArray(value) && value.some((item) => typeof item === 'object')
  ) {
    return null;
  }
  if (typeof value === 'string' && previous.trim().startsWith("'") && !value.includes("'")) {
    return `'${value}'`;
  }
  try {
    const rendered = stringify({ value }).trim();
    const separator = rendered.indexOf('=');
    return separator >= 0 ? rendered.slice(separator + 1).trim() : null;
  } catch {
    return null;
  }
}

function relocateTomlComments(source: string, canonical: string): string {
  const comments: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    const index = tomlSeparator(line, '#');
    if (index >= 0) {
      const comment = line.slice(index).trimEnd();
      if (comment && !comments.includes(comment)) comments.push(comment);
    }
  }
  return comments.length > 0
    ? `${comments.join('\n')}\n${canonical}`
    : canonical;
}

/**
 * Preserve TOML comments, table/dotted-key layout, and scalar quote style for
 * edits that only change existing scalar assignments. Structural edits fall
 * back to canonical TOML with source comments relocated to the document head.
 */
export function updateUndulateTOMLSource(
  source: string | undefined,
  root: UndulateRoot,
): string {
  if (!source) return stringifyUndulateTOML(root);
  const previousRoot = parseUndulateTOML(source);
  const previous = undulateRootToTOMLObject(previousRoot);
  const next = undulateRootToTOMLObject(root);
  let tablePath: string[] = [];
  let inArrayTable = false;
  const lines = source.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
      inArrayTable = true;
      return line;
    }
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      tablePath = tomlKeyPath(trimmed.slice(1, -1)) ?? [];
      inArrayTable = false;
      return line;
    }
    if (!trimmed || trimmed.startsWith('#') || inArrayTable) return line;
    const equals = tomlSeparator(line, '=');
    if (equals < 0) return line;
    const keyPath = tomlKeyPath(line.slice(0, equals));
    if (!keyPath) return line;
    const path = [...tablePath, ...keyPath];
    const before = valueAtPath(previous, path);
    const after = valueAtPath(next, path);
    if (sameTomlValue(before, after)) return line;

    const rest = line.slice(equals + 1);
    const commentIndex = tomlSeparator(rest, '#');
    const valueSource = commentIndex >= 0 ? rest.slice(0, commentIndex) : rest;
    const comment = commentIndex >= 0 ? rest.slice(commentIndex) : '';
    const rendered = serializedTomlValue(after, valueSource);
    if (rendered === null) return line;
    const leading = valueSource.match(/^\s*/)?.[0] ?? ' ';
    const trailing = valueSource.match(/\s*$/)?.[0] ?? '';
    return `${line.slice(0, equals + 1)}${leading}${rendered}${trailing}${comment}`;
  }).join('\n');

  try {
    const patched = undulateRootToTOMLObject(parseUndulateTOML(lines));
    if (sameTomlValue(patched, next)) return lines;
  } catch {
    // Fall through to the safe canonical representation.
  }
  return relocateTomlComments(source, stringifyUndulateTOML(root));
}
