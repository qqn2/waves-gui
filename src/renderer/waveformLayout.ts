import type { DiagramConfig } from '../shared/types';
import { TIME_AXIS_HEIGHT } from '../shared/constants';
import { measureHeadFoot } from './renderHeadFoot';

/** Canvas Y offset (px) where the first signal row is drawn — below time axis and head text. */
export function getWaveformTopInsetPx(
  config: DiagramConfig,
  showTimeAxis: boolean,
): number {
  const axis = showTimeAxis ? TIME_AXIS_HEIGHT : 0;
  const { headHeight } = measureHeadFoot(config);
  return axis + headHeight;
}
