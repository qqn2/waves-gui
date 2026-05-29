import { saveAs } from 'file-saver';
import type { DiagramState, ViewState } from '../shared/types';
import { toWavedromJSON } from '../wavedromBridge/toWavedromJSON';
import { exportBaseName } from './fileName';

export function exportWavedromJSON(
  diagram: DiagramState,
  view?: ViewState,
): void {
  const root = toWavedromJSON(diagram);
  const text = JSON.stringify(root, null, 2);
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const base = view ? exportBaseName(view) : 'waveform';
  saveAs(blob, `${base}.json`);
}
