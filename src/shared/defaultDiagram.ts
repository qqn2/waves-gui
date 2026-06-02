import { fromWavedromJSON } from '../wavedromBridge';
import type { WdRoot } from '../wavedromBridge/wdTypes';
import type { DiagramState } from './types';

/** Bundled clock-and-reset template (WaveDrom `P` = clock with rising-edge arrow). */
export const DEFAULT_WAVEDROM_ROOT: WdRoot = {
  signal: [
    { name: 'clk', wave: 'P........' },
    { name: 'reset_n', wave: '10........' },
    { name: 'enable', wave: '0..1..0..1' },
  ],
  config: { hscale: 1 },
  head: { text: 'Clock and reset' },
};

export function createDefaultDiagram(): DiagramState {
  return fromWavedromJSON(DEFAULT_WAVEDROM_ROOT);
}
