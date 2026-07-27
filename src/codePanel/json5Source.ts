import { parse, tokenize, type Token } from 'jju/lib/parse.js';
import { update } from 'jju/lib/document.js';

function json5Options() {
  return {
    mode: 'json5' as const,
    reserved_keys: 'throw' as const,
  };
}

/**
 * Parse WaveDrom's JSON5-like source syntax without allowing prototype keys.
 *
 * Keeping this in one module ensures the editor, preview, and file loader all
 * accept the same syntax.
 */
export function parseJSON5Source(source: string): unknown {
  return parse(source, json5Options()) as unknown;
}

/**
 * Apply a new document value to retained JSON5 source. jju tokenizes the
 * original source into a concrete syntax tree and changes only values whose
 * semantic representation changed, retaining comments and local formatting.
 */
export function updateJSON5Source(
  source: string | undefined,
  value: unknown,
): string {
  if (!source) return JSON.stringify(value, null, 2);
  // jju records the detected source style on its options object, so each
  // document needs a fresh object to prevent quote/indent style bleed.
  const updated = update(source, value, json5Options());
  return restoreOrphanedComments(source, updated);
}

export function json5SyntaxError(error: unknown): string {
  const detail =
    error instanceof Error
      ? error.message.split('\n', 1)[0]
      : 'Unknown syntax error';
  return `Invalid JSON/JSON5 syntax: ${detail}`;
}

interface OrphanedComment {
  raw: string;
  stack: Array<string | number>;
}

/**
 * The CST updater naturally removes syntax belonging to a deleted property or
 * array entry. Comments are user-authored content, so relocate any comment
 * that would otherwise disappear to the nearest surviving container.
 */
function restoreOrphanedComments(source: string, updated: string): string {
  const sourceComments = commentTokens(source);
  if (sourceComments.length === 0) return updated;

  const remaining = new Map<string, number>();
  for (const token of commentTokens(updated)) {
    remaining.set(token.raw, (remaining.get(token.raw) ?? 0) + 1);
  }

  const orphans: OrphanedComment[] = [];
  for (const token of sourceComments) {
    const count = remaining.get(token.raw) ?? 0;
    if (count > 0) {
      remaining.set(token.raw, count - 1);
    } else {
      orphans.push({ raw: token.raw, stack: [...token.stack] });
    }
  }
  if (orphans.length === 0) return updated;

  const tokens = tokenize(updated, json5Options());
  const groups = new Map<number, OrphanedComment[]>();
  for (const orphan of orphans) {
    const position = nearestContainerClose(tokens, orphan.stack);
    const group = groups.get(position) ?? [];
    group.push(orphan);
    groups.set(position, group);
  }

  let result = updated;
  const positions = [...groups.keys()].sort((a, b) => b - a);
  for (const position of positions) {
    const comments = groups.get(position)!;
    const depth = survivingDepth(tokens, position);
    const indent = '  '.repeat(depth + 1);
    const closeIndent = '  '.repeat(depth);
    const block = comments
      .map(({ raw }) => `${indent}${raw.replace(/\n/g, `\n${indent}`)}`)
      .join('\n');
    result =
      `${result.slice(0, position)}\n${block}\n${closeIndent}`
      + result.slice(position);
  }
  return result;
}

function commentTokens(source: string): Token[] {
  return tokenize(source, json5Options()).filter(
    (token) => token.type === 'comment',
  );
}

function nearestContainerClose(
  tokens: Token[],
  originalStack: Array<string | number>,
): number {
  let stack = [...originalStack];
  while (true) {
    const position = containerClose(tokens, stack);
    if (position !== null) return position;
    if (stack.length === 0) return tokensRawLength(tokens);
    stack = stack.slice(0, -1);
  }
}

function containerClose(
  tokens: Token[],
  stack: Array<string | number>,
): number | null {
  let offset = 0;
  let found: number | null = null;
  const wanted = JSON.stringify(stack);
  for (const token of tokens) {
    if (
      token.type === 'separator'
      && (token.raw === ']' || token.raw === '}')
      && JSON.stringify(token.stack) === wanted
    ) {
      found = offset;
    }
    offset += token.raw.length;
  }
  return found;
}

function survivingDepth(tokens: Token[], position: number): number {
  let offset = 0;
  for (const token of tokens) {
    if (offset === position) return token.stack.length;
    offset += token.raw.length;
  }
  return 0;
}

function tokensRawLength(tokens: Token[]): number {
  return tokens.reduce((total, token) => total + token.raw.length, 0);
}
