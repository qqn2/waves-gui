export const WAVEDROM_EDITOR_BASE_URL = 'https://wavedrom.com/editor.html';

export const WAVEDROM_DATA_WARNING =
  'Privacy warning: this sends the complete diagram JSON to wavedrom.com in the URL. ' +
  'It may be recorded in browser history, network logs, or WaveDrom server logs. ' +
  'Do not continue with confidential data.\n\nOpen in WaveDrom Editor?';

export function buildWavedromEditorUrl(code: string): string {
  return `${WAVEDROM_EDITOR_BASE_URL}?${encodeURIComponent(code)}`;
}

export function confirmAndOpenInWavedrom(code: string): boolean {
  if (!window.confirm(WAVEDROM_DATA_WARNING)) return false;

  window.open(buildWavedromEditorUrl(code), '_blank', 'noopener,noreferrer');
  return true;
}
