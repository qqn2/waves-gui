import { fromWavedromJSON } from '../wavedromBridge';
import type { WdRoot } from '../wavedromBridge/wdTypes';
import { CLOCK_RESET_SAMPLE } from './clockResetSample';
import type { DiagramState } from './types';

/** @deprecated use CLOCK_RESET_SAMPLE */
export const DEFAULT_WAVEDROM_ROOT: WdRoot = CLOCK_RESET_SAMPLE;

export function createDefaultDiagram(): DiagramState {
  return fromWavedromJSON(CLOCK_RESET_SAMPLE);
}
