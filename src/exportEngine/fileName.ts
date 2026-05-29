import type { ViewState } from '../shared/types';

export function exportBaseName(view: ViewState): string {
  const fn = view.fileName;
  if (!fn) return 'waveform';
  const dot = fn.lastIndexOf('.');
  return dot > 0 ? fn.slice(0, dot) : fn;
}
