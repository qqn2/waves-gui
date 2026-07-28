import {
  isAlias,
  isMap,
  isScalar,
  parseDocument,
  stringify,
  visit,
} from 'yaml';
import type { UndulateRoot } from './types';
import {
  isMappingRecord,
  undulateMappingToRoot,
  undulateRootToMapping,
  UNSAFE_MAPPING_KEYS,
} from './mappingFormat';

export const MAX_UNDULATE_YAML_BYTES = 1_000_000;
export const MAX_UNDULATE_YAML_NODES = 50_000;
export const MAX_UNDULATE_YAML_DEPTH = 64;

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
  if (!isMappingRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (UNSAFE_MAPPING_KEYS.has(key)) {
      throw yamlError(`unsafe mapping key at ${path}.${key}`);
    }
    if (key === '<<') throw yamlError('merge keys are not supported');
    assertSafeJSONValue(item, depth + 1, `${path}.${key}`);
  }
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
  return undulateMappingToRoot(value, yamlError);
}

export function undulateRootToYAMLObject(
  root: UndulateRoot,
): Record<string, unknown> {
  return undulateRootToMapping(root, yamlError);
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
