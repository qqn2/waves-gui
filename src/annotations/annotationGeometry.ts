import { CELL_WIDTH } from '../shared/constants';
import type { SignalOrGroup } from '../shared/types';
import { buildRowLayout, totalContentHeight, type RowLayoutEntry } from '../renderer/rowLayout';

/** Logical X at the center of a time-step column. */
export function stepCenterX(step: number): number {
  return (step + 0.5) * CELL_WIDTH;
}

/** Logical X at the left edge of a time-step column. */
export function stepLeftX(step: number): number {
  return step * CELL_WIDTH;
}

export function getSignalRowY(signalId: string, signals: SignalOrGroup[]): number {
  const rows = buildRowLayout(signals);
  const row = rows.find((r) => r.id === signalId);
  if (!row) return 0;
  return row.y + row.height / 2;
}

export function findRow(signalId: string, signals: SignalOrGroup[]): RowLayoutEntry | undefined {
  return buildRowLayout(signals).find((r) => r.id === signalId);
}

export function diagramContentHeight(signals: SignalOrGroup[]): number {
  return totalContentHeight(buildRowLayout(signals));
}
