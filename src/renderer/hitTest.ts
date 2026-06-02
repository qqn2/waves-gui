import type { DiagramState, Signal, SignalOrGroup, ViewState } from '../shared/types';
import { CELL_WIDTH, TIME_AXIS_HEIGHT } from '../shared/constants';
import { buildRowLayout } from './rowLayout';
import { measureHeadFoot } from './renderHeadFoot';
import { canvasToLogicalX, canvasToLogicalY, type ViewTransform } from './coordinates';
import { stepAtLogicalXForSignal } from './laneHitTest';

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

function buildSignalById(signals: SignalOrGroup[]): Map<string, Signal> {
  const map = new Map<string, Signal>();
  const walk = (list: SignalOrGroup[]) => {
    for (const item of list) {
      if (item.type === 'group') walk(item.children);
      else map.set(item.id, item);
    }
  };
  walk(signals);
  return map;
}

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

  const axisOffset = view.showTimeAxis ? TIME_AXIS_HEIGHT : 0;
  const { headHeight } = measureHeadFoot(diagram.config);
  const waveformTop = axisOffset + headHeight;
  const logicalX = canvasToLogicalX(canvasX, transform);
  const logicalY = canvasToLogicalY(canvasY - waveformTop, transform);

  const rows = buildRowLayout(diagram.signals);
  const signalById = buildSignalById(diagram.signals);
  const totalSteps = diagram.config.totalSteps;

  for (const row of rows) {
    if (logicalY < row.y || logicalY >= row.y + row.height) continue;

    if (row.type === 'group') {
      const raw = Math.floor(logicalX / CELL_WIDTH);
      const step =
        raw >= 0 && raw < totalSteps ? raw : null;
      return {
        ...MISS,
        signalId: row.id,
        signalType: 'group',
        step,
      };
    }

    const signal = signalById.get(row.id);
    const step =
      signal !== undefined
        ? stepAtLogicalXForSignal(logicalX, signal, totalSteps)
        : null;

    if (step === null) {
      return MISS;
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
