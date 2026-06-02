import type { DiagramState, ViewState } from '../shared/types';
import { CELL_WIDTH, TIME_AXIS_HEIGHT } from '../shared/constants';
import { buildRowLayout, totalContentHeight } from '../renderer/rowLayout';

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
  const axisOffset = view.showTimeAxis ? TIME_AXIS_HEIGHT : 0;
  const waveformWidth =
    diagram.config.totalSteps * CELL_WIDTH * diagram.config.hscale;
  const waveformHeight = contentH + axisOffset;
  return {
    labelWidth: view.labelWidth,
    waveformWidth,
    waveformHeight,
    totalWidth: view.labelWidth + waveformWidth,
    totalHeight: waveformHeight,
    axisOffset,
  };
}
