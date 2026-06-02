/**
 * WaveDrom bus fill colors (default skin, digits 2–9).
 * `=` in wave strings is color 2 (same as digit `2`).
 * @see node_modules/wavedrom/skins/default.js classes s7–s14
 */

export const WAVEDROM_COLOR_INDEXES = [2, 3, 4, 5, 6, 7, 8, 9] as const;

export type WavedromColorIndex = (typeof WAVEDROM_COLOR_INDEXES)[number];

/** Fill colors from wavedrom/skins/default.js (vvv-N bricks). */
export const WAVEDROM_BUS_FILLS: Record<WavedromColorIndex, string> = {
  2: '#ffffff',
  3: '#ffffb4',
  4: '#ffe0b9',
  5: '#b9e0ff',
  6: '#ccfdfe',
  7: '#cdfdc5',
  8: '#f0c1fb',
  9: '#f5c2c0',
};

const FILL_LOOKUP = new Map<string, WavedromColorIndex>(
  WAVEDROM_COLOR_INDEXES.map((idx) => [WAVEDROM_BUS_FILLS[idx].toLowerCase(), idx]),
);

export function isWavedromBusWaveChar(ch: string): boolean {
  return ch === '=' || (ch >= '2' && ch <= '9');
}

export function waveCharToColorIndex(ch: string): WavedromColorIndex | null {
  if (ch === '=' || ch === '2') return 2;
  if (ch >= '3' && ch <= '9') return Number(ch) as WavedromColorIndex;
  return null;
}

/** First character of a bus span in a WaveDrom `wave` string. */
export function colorIndexToWaveChar(index: WavedromColorIndex): string {
  return index === 2 ? '=' : String(index);
}

export function fillHexForColorIndex(index: WavedromColorIndex): string {
  return WAVEDROM_BUS_FILLS[index];
}

export function colorIndexFromFillHex(hex: string | undefined): WavedromColorIndex {
  if (!hex) return 2;
  const hit = FILL_LOOKUP.get(hex.toLowerCase());
  return hit ?? 2;
}

export function isWavedromBusFillHex(hex: string): boolean {
  return FILL_LOOKUP.has(hex.toLowerCase());
}
