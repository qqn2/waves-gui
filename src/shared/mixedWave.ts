import type { Signal, SignalOrGroup } from './types';

export const MIXED_WAVE_NOTICE =
  'Mixed bus/scalar waves are read-only because Draw cannot represent every source cell.';

export function hasOpaqueMixedWave(signal: Signal): boolean {
  return signal.sourceWaveData !== undefined;
}

export function countOpaqueMixedWaves(signals: SignalOrGroup[]): number {
  let count = 0;
  const walk = (items: SignalOrGroup[]) => {
    items.forEach((item) => {
      if (item.type === 'group') walk(item.children);
      else if (hasOpaqueMixedWave(item)) count += 1;
    });
  };
  walk(signals);
  return count;
}
