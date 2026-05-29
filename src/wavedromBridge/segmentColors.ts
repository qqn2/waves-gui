/** WaveDrom bus color markers 2–9 */
export const SEGMENT_COLOR_PALETTE: Record<string, string> = {
  '2': '#E06C75',
  '3': '#98C379',
  '4': '#61AFEF',
  '5': '#C678DD',
  '6': '#D19A66',
  '7': '#56B6C2',
  '8': '#BE5046',
  '9': '#ABB2BF',
};

export const COLOR_TO_MARKER = new Map(
  Object.entries(SEGMENT_COLOR_PALETTE).map(([marker, color]) => [color, marker]),
);
