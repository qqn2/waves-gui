/**
 * JSON editor ↔ diagram sync.
 *
 * diagramToCodeString / parseCodeToDiagram select the WaveDrom or Undulate bridge
 * from document capabilities and JSON content.
 *
 * Sync timing (see useCodeToDiagram / useDiagramCode):
 *   - Typing in the JSON panel is debounced into one document-history transaction.
 *   - loadDiagram cancels any pending debounced JSON apply (template / file load).
 *   - Canvas/tool edits must flush the editor first (flushRegistry + codeFlush.ts) so a
 *     pending debounced JSON write cannot overwrite a paint stroke.
 */
import {
  fromWavedromJSON,
  toWavedromJSON,
  validateWavedromJSON,
} from '../wavedromBridge';
import {
  fromUndulateJSON,
  isUndulateJSON,
  toUndulateJSON,
  validateUndulateJSON,
} from '../undulateBridge';
import type { WdRoot } from '../wavedromBridge';
import type { UndulateRoot } from '../undulateBridge';
import { scanExtensionContent } from '../shared/annotations';
import type { DiagramState } from '../shared/types';
import {
  json5SyntaxError,
  parseJSON5Source,
  updateJSON5Source,
} from './json5Source';

export const CODE_DEBOUNCE_MS = 400;

export type DiagramCodeFormat = 'wavedrom' | 'undulate';

export function diagramCodeFormat(diagram: DiagramState): DiagramCodeFormat {
  const sourceFormat = diagram.compatibility?.sourceFormat;
  return (
    diagram.compatibility?.extensionsEnabled === true
    || sourceFormat === 'undulate-json'
    || sourceFormat === 'undulate-yaml'
    || sourceFormat === 'undulate-toml'
    || scanExtensionContent(diagram).hasExtensions
  )
    ? 'undulate'
    : 'wavedrom';
}

export function diagramToCodeStringForFormat(
  diagram: DiagramState,
  format: DiagramCodeFormat,
): string {
  const root =
    format === 'undulate'
      ? toUndulateJSON(diagram)
      : toWavedromJSON(diagram);
  return updateJSON5Source(diagram.compatibility?.sourceText, root);
}

export function diagramToCodeString(diagram: DiagramState): string {
  return diagramToCodeStringForFormat(diagram, diagramCodeFormat(diagram));
}

export interface ParseCodeOptions {
  preferUndulate?: boolean;
}

export function detectCodeFormat(
  code: string,
  options: ParseCodeOptions = {},
): DiagramCodeFormat {
  try {
    return isUndulateJSON(parseJSON5Source(code)) || options.preferUndulate
      ? 'undulate'
      : 'wavedrom';
  } catch {
    return options.preferUndulate ? 'undulate' : 'wavedrom';
  }
}

/** Returns null when valid, otherwise an error message. */
export function validateCodeString(
  code: string,
  options: ParseCodeOptions = {},
): string | null {
  let parsed: unknown;
  try {
    parsed = parseJSON5Source(code);
  } catch (error) {
    return json5SyntaxError(error);
  }
  return isUndulateJSON(parsed) || options.preferUndulate
    ? validateUndulateJSON(parsed)
    : validateWavedromJSON(parsed);
}

export type ApplyCodeResult =
  | { ok: true; diagram: DiagramState }
  | { ok: false; error: string };

export function parseCodeToDiagram(
  code: string,
  options: ParseCodeOptions = {},
): ApplyCodeResult {
  let parsed: unknown;
  try {
    parsed = parseJSON5Source(code);
  } catch (error) {
    return { ok: false, error: json5SyntaxError(error) };
  }
  const undulate = isUndulateJSON(parsed) || options.preferUndulate;
  const err = undulate
    ? validateUndulateJSON(parsed)
    : validateWavedromJSON(parsed);
  if (err) return { ok: false, error: err };
  const diagram = undulate
    ? fromUndulateJSON(parsed as UndulateRoot)
    : fromWavedromJSON(parsed as WdRoot);
  diagram.compatibility = {
    ...diagram.compatibility,
    extensionsEnabled:
      diagram.compatibility?.extensionsEnabled === true || (
        undulate && options.preferUndulate === true
      ),
    sourceText: code,
  };
  if (undulate && options.preferUndulate && diagram.compatibility) {
    diagram.compatibility.extensionsEnabled = true;
  }
  return { ok: true, diagram };
}
