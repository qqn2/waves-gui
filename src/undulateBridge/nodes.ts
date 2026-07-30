import type { Signal } from '../shared/types';

const EXPANDED_NODE_NAME = /^[\p{L}\p{N}_.]+$/u;

export interface ParsedUndulateNodes {
  pattern: string;
  namesByStep: Record<number, string>;
}

export function parseUndulateNodes(value: string): ParsedUndulateNodes | null {
  const [pattern, ...names] = value.trim().split(/\s+/u);
  if (!pattern) return null;
  const slots = [...pattern]
    .map((char, step) => char === '#' ? step : -1)
    .filter((step) => step >= 0);
  if (slots.length !== names.length) return null;
  if (names.some((name) => !EXPANDED_NODE_NAME.test(name))) return null;
  const namesByStep: Record<number, string> = {};
  slots.forEach((step, index) => {
    namesByStep[step] = names[index]!;
  });
  return { pattern, namesByStep };
}

export function wavedromNodePattern(value: string): string {
  return parseUndulateNodes(value)?.pattern.replaceAll('#', '.') ?? value;
}

export function nodeToUndulate(signal: Signal): string | undefined {
  const expanded = Object.entries(signal.nodeNames ?? {})
    .map(([step, name]) => [Number(step), name] as const)
    .filter(([step, name]) =>
      Number.isInteger(step)
      && step >= 0
      && EXPANDED_NODE_NAME.test(name)
    )
    .sort(([left], [right]) => left - right);
  if (expanded.length === 0) return signal.node;
  const requiredLength = expanded[expanded.length - 1]![0] + 1;
  const pattern = (signal.node ?? '').padEnd(requiredLength, '.').split('');
  for (const [step] of expanded) pattern[step] = '#';
  return `${pattern.join('')} ${expanded.map(([, name]) => name).join(' ')}`;
}
