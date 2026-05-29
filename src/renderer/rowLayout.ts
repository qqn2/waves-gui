import type { SignalOrGroup } from '../shared/types';
import { GROUP_HEADER_HEIGHT, ROW_HEIGHT } from '../shared/constants';

export interface RowLayoutEntry {
  id: string;
  y: number;
  height: number;
  type: 'bit' | 'vector' | 'spacer' | 'group';
}

/** Flat visible rows in logical pixels (zoom = 1). */
export function buildRowLayout(signals: SignalOrGroup[]): RowLayoutEntry[] {
  const rows: RowLayoutEntry[] = [];
  let y = 0;

  const walk = (list: SignalOrGroup[]) => {
    for (const item of list) {
      if (item.type === 'group') {
        rows.push({ id: item.id, y, height: GROUP_HEADER_HEIGHT, type: 'group' });
        y += GROUP_HEADER_HEIGHT;
        if (!item.collapsed) walk(item.children);
      } else {
        const rh = item.rowHeight ?? ROW_HEIGHT;
        rows.push({ id: item.id, y, height: rh, type: item.type });
        y += rh;
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
