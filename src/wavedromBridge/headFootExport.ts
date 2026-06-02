import type { DiagramConfig } from '../shared/types';
import type { WdRoot } from './wdTypes';

type WdHead = NonNullable<WdRoot['head']>;
type WdFoot = NonNullable<WdRoot['foot']>;

/** WaveDrom root `head` object (omit empty slices). */
export function exportWdHead(head: DiagramConfig['head']): WdHead | undefined {
  if (!head) return undefined;
  const out: WdHead = {};
  if (head.text) out.text = head.text;
  if (head.tick !== undefined) out.tick = head.tick;
  if (head.every !== undefined) out.every = head.every;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** WaveDrom root `foot` object (omit empty slices). */
export function exportWdFoot(foot: DiagramConfig['foot']): WdFoot | undefined {
  if (!foot) return undefined;
  const out: WdFoot = {};
  if (foot.text) out.text = foot.text;
  if (foot.tock !== undefined) out.tock = foot.tock;
  if (foot.every !== undefined) out.every = foot.every;
  return Object.keys(out).length > 0 ? out : undefined;
}
