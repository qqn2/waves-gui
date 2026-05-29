import type { DiagramState, ViewState } from '../shared/types';
import { CELL_WIDTH } from '../shared/constants';
import { buildRowLayout } from './rowLayout';
import { canvasToLogicalX, canvasToLogicalY, type ViewTransform } from './coordinates';

export interface HitTestResult {
  signalId: string | null;
  signalType: 'bit' | 'vector' | 'group' | null;
  step: number | null;
  half: 'top' | 'bottom' | null;
  isLabelArea: boolean;
  annotationId: string | null;
}

const MISS: HitTestResult = {
  signalId: null,
  signalType: null,
  step: null,
  half: null,
  isLabelArea: false,
  annotationId: null,
};

export function hitTest(
  canvasX: number,
  canvasY: number,
  diagram: DiagramState,
  view: ViewState,
): HitTestResult {
  const transform: ViewTransform = {
    zoom: view.zoom,
    hscale: diagram.config.hscale,
    scrollX: view.scrollX,
    scrollY: view.scrollY,
  };

  const logicalX = canvasToLogicalX(canvasX, transform);
  const logicalY = canvasToLogicalY(canvasY, transform);
  const step = Math.floor(logicalX / CELL_WIDTH);

  if (step < 0 || step >= diagram.config.totalSteps) {
    return MISS;
  }

  const rows = buildRowLayout(diagram.signals);
  for (const row of rows) {
    if (logicalY < row.y || logicalY >= row.y + row.height) continue;

    if (row.type === 'group') {
      return {
        ...MISS,
        signalId: row.id,
        signalType: 'group',
        step,
      };
    }

    let half: 'top' | 'bottom' | null = null;
    if (row.type === 'bit') {
      const mid = row.y + row.height / 2;
      half = logicalY < mid ? 'top' : 'bottom';
    }

    const signalType: HitTestResult['signalType'] =
      row.type === 'spacer' ? 'bit' : row.type;

    return {
      signalId: row.id,
      signalType,
      step,
      half,
      isLabelArea: false,
      annotationId: null,
    };
  }

  return MISS;
}
