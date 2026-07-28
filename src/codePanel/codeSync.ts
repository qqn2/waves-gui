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
  parseUndulateYAML,
  stringifyUndulateYAML,
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

export type DiagramCodeFormat = 'wavedrom' | 'undulate' | 'undulate-yaml';

export function diagramCodeFormat(diagram: DiagramState): DiagramCodeFormat {
  const sourceFormat = diagram.compatibility?.sourceFormat;
  if (sourceFormat === 'undulate-yaml') return 'undulate-yaml';
  return (
    diagram.compatibility?.extensionsEnabled === true
    || sourceFormat === 'undulate-json'
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
  if (format === 'undulate-yaml') {
    return stringifyUndulateYAML(toUndulateJSON(diagram));
  }
  const root =
    format === 'undulate'
      ? toUndulateJSON(diagram)
      : toWavedromJSON(diagram);
  return updateJSON5Source(diagram.compatibility?.sourceText, root);
}

export function diagramToCodeString(diagram: DiagramState): string {
  return diagramToCodeStringForFormat(diagram, diagramCodeFormat(diagram));
}

export function diagramWithUndulateCodeFormat(
  diagram: DiagramState,
  format: Extract<DiagramCodeFormat, 'undulate' | 'undulate-yaml'>,
): DiagramState {
  return {
    ...diagram,
    version: 2,
    compatibility: {
      ...diagram.compatibility,
      extensionsEnabled: true,
      sourceFormat:
        format === 'undulate-yaml' ? 'undulate-yaml' : 'undulate-json',
      sourceText: undefined,
    },
  };
}

export interface ParseCodeOptions {
  preferUndulate?: boolean;
  preferYAML?: boolean;
}

function parseCodeSource(
  code: string,
  options: ParseCodeOptions,
): { parsed: unknown; yaml: boolean } {
  if (options.preferYAML) {
    return { parsed: parseUndulateYAML(code), yaml: true };
  }
  return { parsed: parseJSON5Source(code), yaml: false };
}

export function detectCodeFormat(
  code: string,
  options: ParseCodeOptions = {},
): DiagramCodeFormat {
  try {
    const { parsed, yaml } = parseCodeSource(code, options);
    if (yaml) return 'undulate-yaml';
    return isUndulateJSON(parsed) || options.preferUndulate
      ? 'undulate'
      : 'wavedrom';
  } catch {
    return options.preferYAML
      ? 'undulate-yaml'
      : options.preferUndulate ? 'undulate' : 'wavedrom';
  }
}

/** Returns null when valid, otherwise an error message. */
export function validateCodeString(
  code: string,
  options: ParseCodeOptions = {},
): string | null {
  let parsed: unknown;
  try {
    parsed = parseCodeSource(code, options).parsed;
  } catch (error) {
    return options.preferYAML
      ? error instanceof Error ? error.message : 'Invalid Undulate YAML'
      : json5SyntaxError(error);
  }
  return options.preferYAML || isUndulateJSON(parsed) || options.preferUndulate
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
    parsed = parseCodeSource(code, options).parsed;
  } catch (error) {
    return {
      ok: false,
      error: options.preferYAML
        ? error instanceof Error ? error.message : 'Invalid Undulate YAML'
        : json5SyntaxError(error),
    };
  }
  const undulate =
    options.preferYAML || isUndulateJSON(parsed) || options.preferUndulate;
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
    ...(options.preferYAML ? { sourceFormat: 'undulate-yaml' as const } : {}),
  };
  if (undulate && options.preferUndulate && diagram.compatibility) {
    diagram.compatibility.extensionsEnabled = true;
  }
  return { ok: true, diagram };
}
