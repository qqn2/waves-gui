import { LABEL_WIDTH } from '../shared/constants';
import { getSafeStorage } from './soloDesk/safeStorage';

export const LABEL_COLUMN_LAYOUT_KEY = 'wavedrom-gui-label-column-width';

export const LABEL_COLUMN_MIN = 120;
export const LABEL_COLUMN_MAX = 520;

export function clampLabelColumnWidth(width: number): number {
  return Math.max(
    LABEL_COLUMN_MIN,
    Math.min(LABEL_COLUMN_MAX, Math.round(width)),
  );
}

export function loadLabelColumnWidth(): number {
  try {
    const raw = getSafeStorage().getItem(LABEL_COLUMN_LAYOUT_KEY);
    if (raw === null) return LABEL_WIDTH;
    const n = Number(raw);
    return Number.isFinite(n) ? clampLabelColumnWidth(n) : LABEL_WIDTH;
  } catch {
    return LABEL_WIDTH;
  }
}

export function saveLabelColumnWidth(width: number): void {
  try {
    getSafeStorage().setItem(
      LABEL_COLUMN_LAYOUT_KEY,
      String(clampLabelColumnWidth(width)),
    );
  } catch {
    // ignore
  }
}
