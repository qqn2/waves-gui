import type { SignalOrGroup } from '../shared/types';

export function countSignals(signals: SignalOrGroup[]): number {
  let n = 0;
  for (const item of signals) {
    if (item.type === 'group') n += countSignals(item.children);
    else if (item.type !== 'spacer') n++;
  }
  return n;
}
