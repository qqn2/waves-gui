import type { DiagramState, ViewState } from '../shared/types';
import { TIME_AXIS_HEIGHT } from '../shared/constants';
import { buildRowLayout, totalContentHeight } from '../renderer/rowLayout';
import { diagramLogicalWidth } from '../renderer/laneTiming';
import { measureHeadFoot } from '../renderer/renderHeadFoot';

export interface ExportDimensions {
  labelWidth: number;
  waveformWidth: number;
  waveformHeight: number;
  totalWidth: number;
  totalHeight: number;
  axisOffset: number;
}

/** Full diagram size at zoom 1, including label column and time axis. */
export function computeExportDimensions(
  diagram: DiagramState,
  view: ViewState,
): ExportDimensions {
  const rows = buildRowLayout(diagram.signals);
  const contentH = totalContentHeight(rows);
  const { headHeight, footHeight } = measureHeadFoot(diagram.config);
  const axisOffset = TIME_AXIS_HEIGHT + headHeight;
  const waveformWidth = diagramLogicalWidth(diagram) * diagram.config.hscale;
  const waveformHeight = contentH + axisOffset + footHeight;
  return {
    labelWidth: view.labelWidth,
    waveformWidth,
    waveformHeight,
    totalWidth: view.labelWidth + waveformWidth,
    totalHeight: waveformHeight,
    axisOffset,
  };
}
