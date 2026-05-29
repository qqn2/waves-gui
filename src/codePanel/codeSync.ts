import {
  fromWavedromJSON,
  toWavedromJSON,
  validateWavedromJSON,
} from '../wavedromBridge';
import type { WdRoot } from '../wavedromBridge';
import type { DiagramState } from '../shared/types';

export const CODE_DEBOUNCE_MS = 400;

export function diagramToCodeString(diagram: DiagramState): string {
  return JSON.stringify(toWavedromJSON(diagram), null, 2);
}

/** Returns null when valid, otherwise an error message. */
export function validateCodeString(code: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(code);
  } catch {
    return 'Invalid JSON syntax';
  }
  return validateWavedromJSON(parsed);
}

export type ApplyCodeResult =
  | { ok: true; diagram: DiagramState }
  | { ok: false; error: string };

export function parseCodeToDiagram(code: string): ApplyCodeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(code);
  } catch {
    return { ok: false, error: 'Invalid JSON syntax' };
  }
  const err = validateWavedromJSON(parsed);
  if (err) return { ok: false, error: err };
  return { ok: true, diagram: fromWavedromJSON(parsed as WdRoot) };
}
