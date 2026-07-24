declare module 'jju/lib/parse.js' {
  import type { ParseOptions, Token } from 'jju';

  export function parse(text: string, options?: ParseOptions): unknown;
  export function tokenize(text: string, options?: ParseOptions): Token[];
  export type { Token };
}

declare module 'jju/lib/document.js' {
  import type { ParseOptions, StringifyOptions } from 'jju';

  export function update(
    text: string,
    value: unknown,
    options?: ParseOptions & StringifyOptions,
  ): string;
}
