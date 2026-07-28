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
