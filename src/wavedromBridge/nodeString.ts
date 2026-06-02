import type { DiagramState, Signal, SignalOrGroup } from '../shared/types';
import { buildNodeIndex } from '../renderer/edgeLayout';

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

export function collectUsedNodeChars(signals: SignalOrGroup[]): Set<string> {
  const used = new Set<string>();
  const walk = (list: SignalOrGroup[]) => {
    for (const item of list) {
      if (item.type === 'group') walk(item.children);
      else if (item.node) {
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
  const used = collectUsedNodeChars(diagram.signals);
  const idxUsed = buildNodeIndex(diagram.signals);
  for (const ch of idxUsed.keys()) used.add(ch);
  for (const ch of LETTER_POOL) {
    if (!used.has(ch)) return ch;
  }
  return null;
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
  const allPad = signal.node.split('').every((c) => c === NODE_PAD_CHAR || c === ' ');
  if (allPad) delete signal.node;
}

export function formatArrowEdge(fromChar: string, toChar: string, label?: string): string {
  const path = `${fromChar}->${toChar}`;
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
