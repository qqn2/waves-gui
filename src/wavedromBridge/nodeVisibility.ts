/** WaveDrom: A–Z node anchors are invisible; other characters are visible markers. */
export function isInvisibleNodeChar(ch: string): boolean {
  return ch.length === 1 && ch >= 'A' && ch <= 'Z';
}

export function isVisibleNodeChar(ch: string): boolean {
  return ch !== '.' && ch !== ' ' && !isInvisibleNodeChar(ch);
}
