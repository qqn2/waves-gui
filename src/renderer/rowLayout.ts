import type { SignalOrGroup } from '../shared/types';
import { GROUP_HEADER_HEIGHT, ROW_HEIGHT } from '../shared/constants';

export interface RowLayoutEntry {
  id: string;
  y: number;
  height: number;
  type: 'bit' | 'vector' | 'analogue' | 'spacer' | 'group';
}

/** Flat visible rows in logical pixels (zoom = 1). */
export function buildRowLayout(
  signals: SignalOrGroup[],
  collapsedGroupIds: readonly string[] = [],
): RowLayoutEntry[] {
  const rows: RowLayoutEntry[] = [];
  let y = 0;

  const walk = (list: SignalOrGroup[]) => {
    for (let index = 0; index < list.length; index++) {
      const item = list[index]!;
      if (item.type === 'group') {
        rows.push({ id: item.id, y, height: GROUP_HEADER_HEIGHT, type: 'group' });
        y += GROUP_HEADER_HEIGHT;
        if (!collapsedGroupIds.includes(item.id)) walk(item.children);
      } else {
        let chainEnd = index;
        let rowHeight = item.rowHeight ?? ROW_HEIGHT;
        while (chainEnd < list.length - 1) {
          const current = list[chainEnd]!;
          const next = list[chainEnd + 1]!;
          if (
            current.type !== 'analogue'
            || current.overlay !== true
            || next.type !== 'analogue'
          ) break;
          chainEnd++;
          rowHeight = Math.max(rowHeight, next.rowHeight ?? ROW_HEIGHT);
        }
        for (let member = index; member <= chainEnd; member++) {
          const signal = list[member]!;
          if (signal.type === 'group') break;
          rows.push({
            id: signal.id,
            y,
            height: rowHeight,
            type: signal.type,
          });
        }
        y += rowHeight;
        index = chainEnd;
      }
    }
  };

  walk(signals);
  return rows;
}

export function totalContentHeight(rows: RowLayoutEntry[]): number {
  if (rows.length === 0) return ROW_HEIGHT;
  const last = rows[rows.length - 1];
  return last.y + last.height;
}
