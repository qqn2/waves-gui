import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  stringify,
  visit,
  type Document,
  type Node,
  type Pair,
  type YAMLMap,
  type YAMLSeq,
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
  const document: Document = parseDocument(source, {
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

function syncYamlScalar(
  document: Document,
  node: Node | null | undefined,
  value: unknown,
): Node {
  if (!isScalar(node)) return document.createNode(value) as Node;
  const previousType = typeof node.value;
  node.value = value;
  node.source = undefined;
  node.format = undefined;
  if (typeof value !== 'string' || previousType !== 'string') {
    node.type = undefined;
  }
  return node;
}

function syncYamlNode(
  document: Document,
  node: Node | null | undefined,
  value: unknown,
): Node {
  if (Array.isArray(value)) {
    if (!isSeq(node)) return document.createNode(value) as Node;
    const sequence = node as YAMLSeq<Node>;
    sequence.items = value.map((item, index) =>
      syncYamlNode(document, sequence.items[index], item)
    );
    return sequence;
  }
  if (isMappingRecord(value)) {
    if (!isMap(node)) return document.createNode(value) as Node;
    const mapping = node as YAMLMap<Node, Node>;
    const existing = new Map<string, Pair<Node, Node>>();
    for (const pair of mapping.items) {
      if (isScalar(pair.key)) existing.set(String(pair.key.value), pair);
    }
    const nextPairs: Array<Pair<Node, Node>> = [];
    for (const [key, item] of Object.entries(value)) {
      const pair = existing.get(key);
      if (pair) {
        pair.value = syncYamlNode(document, pair.value, item);
        nextPairs.push(pair);
      } else {
        nextPairs.push(document.createPair(key, item) as Pair<Node, Node>);
      }
    }
    mapping.items = nextPairs;
    return mapping;
  }
  return syncYamlScalar(document, node, value);
}

/**
 * Update a retained safe YAML document through its syntax tree. Existing
 * mappings, sequences, scalar quoting, and comments survive ordinary edits;
 * newly introduced structures use the canonical YAML style.
 */
export function updateUndulateYAMLSource(
  source: string | undefined,
  root: UndulateRoot,
): string {
  if (!source) return stringifyUndulateYAML(root);
  // Apply the same security and resource checks used by import before
  // retaining any syntax tree from the source.
  parseUndulateYAML(source);
  const document: Document = parseDocument(source, {
    version: '1.2',
    schema: 'core',
    strict: true,
    stringKeys: true,
    uniqueKeys: true,
    prettyErrors: true,
  });
  document.contents = syncYamlNode(
    document,
    document.contents,
    undulateRootToYAMLObject(root),
  );
  return document.toString({ lineWidth: 0 });
}
