import type { DiagramState, Signal, SignalOrGroup } from '../shared/types';
import { buildNodeIndex, collectEdgeEndpointChars, parseEdge } from '../renderer/edgeLayout';

export const NODE_PAD_CHAR = '.' as const;

const LETTER_POOL =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

/** Pad or trim a WaveDrom node string to exactly `totalSteps` characters. */
export function padNodeString(
  node: string | undefined,
  totalSteps: number,
): string | undefined {
  if (node === undefined) return undefined;
  if (node.length >= totalSteps) return node.slice(0, totalSteps);
  const pad = node.length > 0 ? node[node.length - 1]! : NODE_PAD_CHAR;
  return node + pad.repeat(totalSteps - node.length);
}

export function ensureNodeString(signal: Signal, totalSteps: number): string {
  const padded = padNodeString(signal.node, totalSteps);
  if (padded !== undefined) {
    signal.node = padded;
    return padded;
  }
  signal.node = NODE_PAD_CHAR.repeat(totalSteps);
  return signal.node;
}

export function findSignalInDiagram(
  diagram: DiagramState,
  signalId: string,
): Signal | null {
  let found: Signal | null = null;
  const walk = (list: SignalOrGroup[]) => {
    for (const item of list) {
      if (item.type === 'group') walk(item.children);
      else if (item.id === signalId) found = item;
    }
  };
  walk(diagram.signals);
  return found;
}

/** Visible anchor letter at `step`, or null when the cell is padding. */
export function visibleNodeCharAt(
  signal: Signal,
  step: number,
  totalSteps: number,
): string | null {
  if (step < 0 || step >= totalSteps) return null;
  const expanded = signal.nodeNames?.[step];
  if (expanded) return expanded;
  const padded = padNodeString(signal.node, totalSteps);
  if (!padded) return null;
  const ch = padded[step]!;
  if (ch === NODE_PAD_CHAR || ch === ' ') return null;
  return ch;
}

export function collectUsedNodeChars(signals: SignalOrGroup[]): Set<string> {
  const used = new Set<string>();
  const walk = (list: SignalOrGroup[]) => {
    for (const item of list) {
      if (item.type === 'group') walk(item.children);
      else {
        for (const name of Object.values(item.nodeNames ?? {})) used.add(name);
        if (!item.node) continue;
        for (const ch of item.node) {
          if (ch !== NODE_PAD_CHAR && ch !== ' ') used.add(ch);
        }
      }
    }
  };
  walk(signals);
  return used;
}

/** Next free single-letter node id (WaveDrom edge anchor). */
export function allocateNodeChar(diagram: DiagramState): string | null {
  return allocateNodeChars(diagram, 1)[0] ?? null;
}

/** Next `count` free single-letter node ids, without mutating the diagram. */
export function allocateNodeChars(diagram: DiagramState, count: number): string[] {
  const used = collectUsedNodeChars(diagram.signals);
  const idxUsed = buildNodeIndex(diagram.signals);
  for (const ch of idxUsed.keys()) used.add(ch);
  return LETTER_POOL.filter((ch) => !used.has(ch)).slice(0, Math.max(0, count));
}

export function setNodeCharAt(
  signal: Signal,
  step: number,
  char: string | null,
  totalSteps: number,
): void {
  const node = ensureNodeString(signal, totalSteps);
  const fill = char && char !== NODE_PAD_CHAR && char !== ' ' ? char[0]! : NODE_PAD_CHAR;
  if (step < 0 || step >= node.length) return;
  const arr = node.split('');
  arr[step] = fill;
  signal.node = arr.join('');
  if (signal.nodeNames?.[step] !== undefined) {
    delete signal.nodeNames[step];
    if (Object.keys(signal.nodeNames).length === 0) delete signal.nodeNames;
  }
  const allPad = signal.node.split('').every((c) => c === NODE_PAD_CHAR || c === ' ');
  if (allPad) delete signal.node;
}

/** Remove `char` from every signal node string in the diagram. */
export function clearNodeCharFromDiagram(
  diagram: DiagramState,
  char: string,
): void {
  const totalSteps = diagram.config.totalSteps;
  const walk = (list: SignalOrGroup[]) => {
    for (const item of list) {
      if (item.type === 'group') walk(item.children);
      else {
        for (const [rawStep, name] of Object.entries(item.nodeNames ?? {})) {
          if (name !== char) continue;
          delete item.nodeNames![Number(rawStep)];
        }
        if (item.nodeNames && Object.keys(item.nodeNames).length === 0) {
          delete item.nodeNames;
        }
        if (!item.node?.includes(char)) continue;
        for (let step = 0; step < totalSteps; step++) {
          if (!item.node) break;
          if (item.node[step] === char) {
            setNodeCharAt(item, step, null, totalSteps);
          }
        }
      }
    }
  };
  walk(diagram.signals);
}

/** Drop node letters from the removed edge when no other edge[] entry uses them. */
export function pruneUnusedNodeAnchorsAfterEdgeRemoval(
  diagram: DiagramState,
  removedEdge: string,
): void {
  const parsed = parseEdge(removedEdge);
  if (!parsed) return;
  const stillUsed = collectEdgeEndpointChars(diagram.edges ?? []);
  for (const ch of [parsed.fromNode, parsed.toNode]) {
    if (stillUsed.has(ch)) continue;
    clearNodeCharFromDiagram(diagram, ch);
  }
}

export function formatArrowEdge(
  fromChar: string,
  toChar: string,
  label?: string,
  connector = '->',
): string {
  const path = `${fromChar}${connector}${toChar}`;
  const trimmed = label?.trim();
  return trimmed ? `${path} ${trimmed}` : path;
}

/** WaveDrom timing bracket: `I+J 5 ms` */
export function formatTimespanEdge(
  fromChar: string,
  toChar: string,
  label?: string,
): string {
  const path = `${fromChar}+${toChar}`;
  const trimmed = label?.trim();
  return trimmed ? `${path} ${trimmed}` : path;
}
