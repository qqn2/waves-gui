import type { ParseCodeOptions } from '../codePanel/codeSync';

export type SampleFormat =
  | 'wavedrom-json'
  | 'undulate-json'
  | 'undulate-yaml'
  | 'undulate-toml';

export function sampleParseOptions(format?: SampleFormat): ParseCodeOptions {
  if (format === 'undulate-yaml') {
    return { preferUndulate: true, preferYAML: true };
  }
  if (format === 'undulate-toml') {
    return { preferUndulate: true, preferTOML: true };
  }
  if (format === 'undulate-json') return { preferUndulate: true };
  return {};
}

export function samplePreviewFileName(file: string, theme: 'light' | 'dark'): string {
  return file.replace(/\.[^.]+$/i, `.${theme}.svg`);
}
