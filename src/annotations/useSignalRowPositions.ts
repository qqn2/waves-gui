import { useMemo } from 'react';
import type { SignalOrGroup } from '../shared/types';
import { buildRowLayout, type RowLayoutEntry } from '../renderer/rowLayout';
import { getSignalRowY } from './annotationGeometry';

export interface SignalRowPosition {
  id: string;
  yCenter: number;
  row: RowLayoutEntry;
}

export function useSignalRowPositions(signals: SignalOrGroup[]): {
  rows: RowLayoutEntry[];
  positions: SignalRowPosition[];
  getRowY: (signalId: string) => number;
  getRow: (signalId: string) => RowLayoutEntry | undefined;
} {
  return useMemo(() => {
    const rows = buildRowLayout(signals);
    const positions: SignalRowPosition[] = rows
      .filter((r) => r.type === 'bit' || r.type === 'vector')
      .map((row) => ({
        id: row.id,
        yCenter: row.y + row.height / 2,
        row,
      }));
    const byId = new Map(positions.map((p) => [p.id, p]));
    return {
      rows,
      positions,
      getRowY: (signalId: string) => getSignalRowY(signalId, signals),
      getRow: (signalId: string) => byId.get(signalId)?.row,
    };
  }, [signals]);
}

export { getSignalRowY };
