import { saveAs } from 'file-saver';
import type { DiagramState, ViewState } from '../shared/types';
import {
  stringifyUndulateTOML,
  stringifyUndulateYAML,
  toUndulateJSON,
} from '../undulateBridge';
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

export function exportUndulateJSON(
  diagram: DiagramState,
  view?: ViewState,
): void {
  const root = toUndulateJSON(diagram);
  const text = JSON.stringify(root, null, 2);
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const base = view ? exportBaseName(view) : 'waveform';
  saveAs(blob, `${base}.undulate.json`);
}

export function exportUndulateYAML(
  diagram: DiagramState,
  view?: ViewState,
): void {
  const text = stringifyUndulateYAML(toUndulateJSON(diagram));
  const blob = new Blob([text], { type: 'application/yaml;charset=utf-8' });
  const base = view ? exportBaseName(view) : 'waveform';
  saveAs(blob, `${base}.undulate.yaml`);
}

export function exportUndulateTOML(
  diagram: DiagramState,
  view?: ViewState,
): void {
  const text = stringifyUndulateTOML(toUndulateJSON(diagram));
  const blob = new Blob([text], { type: 'application/toml;charset=utf-8' });
  const base = view ? exportBaseName(view) : 'waveform';
  saveAs(blob, `${base}.undulate.toml`);
}
