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
  parseUndulateTOML,
  parseUndulateYAML,
  updateUndulateTOMLSource,
  updateUndulateYAMLSource,
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

export type DiagramCodeFormat =
  | 'wavedrom'
  | 'undulate'
  | 'undulate-yaml'
  | 'undulate-toml';

export function diagramCodeFormat(diagram: DiagramState): DiagramCodeFormat {
  const sourceFormat = diagram.compatibility?.sourceFormat;
  if (sourceFormat === 'undulate-yaml') return 'undulate-yaml';
  if (sourceFormat === 'undulate-toml') return 'undulate-toml';
  return (
    diagram.compatibility?.extensionsEnabled === true
    || sourceFormat === 'undulate-json'
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
    return updateUndulateYAMLSource(
      diagram.compatibility?.sourceFormat === 'undulate-yaml'
        ? diagram.compatibility.sourceText
        : undefined,
      toUndulateJSON(diagram),
    );
  }
  if (format === 'undulate-toml') {
    return updateUndulateTOMLSource(
      diagram.compatibility?.sourceFormat === 'undulate-toml'
        ? diagram.compatibility.sourceText
        : undefined,
      toUndulateJSON(diagram),
    );
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
  format: Extract<
    DiagramCodeFormat,
    'undulate' | 'undulate-yaml' | 'undulate-toml'
  >,
): DiagramState {
  return {
    ...diagram,
    version: 2,
    compatibility: {
      ...diagram.compatibility,
      extensionsEnabled: true,
      sourceFormat:
        format === 'undulate-yaml'
          ? 'undulate-yaml'
          : format === 'undulate-toml' ? 'undulate-toml' : 'undulate-json',
      sourceText: undefined,
    },
  };
}

export interface ParseCodeOptions {
  preferUndulate?: boolean;
  preferYAML?: boolean;
  preferTOML?: boolean;
}

function parseCodeSource(
  code: string,
  options: ParseCodeOptions,
): { parsed: unknown; mappingFormat?: 'undulate-yaml' | 'undulate-toml' } {
  if (options.preferYAML) {
    return { parsed: parseUndulateYAML(code), mappingFormat: 'undulate-yaml' };
  }
  if (options.preferTOML) {
    return { parsed: parseUndulateTOML(code), mappingFormat: 'undulate-toml' };
  }
  return { parsed: parseJSON5Source(code) };
}

function mappingSyntaxError(
  error: unknown,
  options: ParseCodeOptions,
): string | null {
  if (!options.preferYAML && !options.preferTOML) return null;
  if (error instanceof Error) return error.message;
  return options.preferTOML ? 'Invalid Undulate TOML' : 'Invalid Undulate YAML';
}

export function detectCodeFormat(
  code: string,
  options: ParseCodeOptions = {},
): DiagramCodeFormat {
  try {
    const { parsed, mappingFormat } = parseCodeSource(code, options);
    if (mappingFormat) return mappingFormat;
    return isUndulateJSON(parsed) || options.preferUndulate
      ? 'undulate'
      : 'wavedrom';
  } catch {
    return options.preferYAML
      ? 'undulate-yaml'
      : options.preferTOML
        ? 'undulate-toml'
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
    return mappingSyntaxError(error, options) ?? json5SyntaxError(error);
  }
  return options.preferYAML
    || options.preferTOML
    || isUndulateJSON(parsed)
    || options.preferUndulate
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
      error: mappingSyntaxError(error, options) ?? json5SyntaxError(error),
    };
  }
  const undulate =
    options.preferYAML
    || options.preferTOML
    || isUndulateJSON(parsed)
    || options.preferUndulate;
  const err = undulate
    ? validateUndulateJSON(parsed)
    : validateWavedromJSON(parsed);
  if (err) return { ok: false, error: err };
  let diagram: DiagramState;
  try {
    diagram = undulate
      ? fromUndulateJSON(parsed as UndulateRoot)
      : fromWavedromJSON(parsed as WdRoot);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not convert source document',
    };
  }
  diagram.compatibility = {
    ...diagram.compatibility,
    extensionsEnabled:
      diagram.compatibility?.extensionsEnabled === true || (
        undulate && options.preferUndulate === true
      ),
    sourceText: code,
    ...(options.preferYAML ? { sourceFormat: 'undulate-yaml' as const } : {}),
    ...(options.preferTOML ? { sourceFormat: 'undulate-toml' as const } : {}),
  };
  if (undulate && options.preferUndulate && diagram.compatibility) {
    diagram.compatibility.extensionsEnabled = true;
  }
  return { ok: true, diagram };
}
