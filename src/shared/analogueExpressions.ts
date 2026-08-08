export interface AnalogueContext {
  vssa: number;
  vdda: number;
}

export const DEFAULT_ANALOGUE_CONTEXT: AnalogueContext = {
  vssa: 0,
  vdda: 1.8,
};

export const ANALOGUE_EXPRESSION_MAX_LENGTH = 2_000;
export const ANALOGUE_CURVE_INTERVALS = 64;
export const UNDULATE_SEQUENCE_MAX_VALUES = 10_000;
const MAX_TOKENS = 512;
const MAX_ABS_RESULT = 1_000_000_000;

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'identifier'; value: string }
  | { kind: 'operator'; value: '+' | '-' | '*' | '/' | '%' | '**' }
  | { kind: 'left' | 'right' | 'comma' | 'end' };

type ExpressionNode =
  | { kind: 'number'; value: number }
  | { kind: 'variable'; name: string }
  | { kind: 'unary'; operator: '+' | '-'; value: ExpressionNode }
  | {
      kind: 'binary';
      operator: '+' | '-' | '*' | '/' | '%' | '**';
      left: ExpressionNode;
      right: ExpressionNode;
    }
  | { kind: 'call'; name: string; arguments: ExpressionNode[] };

export class AnalogueExpressionError extends Error {}

function tokenize(source: string): Token[] {
  if (source.length === 0 || source.length > ANALOGUE_EXPRESSION_MAX_LENGTH) {
    throw new AnalogueExpressionError(
      `expression must contain 1 to ${ANALOGUE_EXPRESSION_MAX_LENGTH} characters`,
    );
  }
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index]!;
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    const number = source.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      const value = Number(number[0]);
      if (!Number.isFinite(value)) {
        throw new AnalogueExpressionError('numeric literal must be finite');
      }
      tokens.push({ kind: 'number', value });
      index += number[0].length;
    } else {
      const identifier = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (identifier) {
        tokens.push({ kind: 'identifier', value: identifier[0] });
        index += identifier[0].length;
      } else if (char === '(') {
        tokens.push({ kind: 'left' });
        index++;
      } else if (char === ')') {
        tokens.push({ kind: 'right' });
        index++;
      } else if (char === ',') {
        tokens.push({ kind: 'comma' });
        index++;
      } else if (char === '*' && source[index + 1] === '*') {
        tokens.push({ kind: 'operator', value: '**' });
        index += 2;
      } else if (
        char === '+'
        || char === '-'
        || char === '*'
        || char === '/'
        || char === '%'
      ) {
        tokens.push({ kind: 'operator', value: char });
        index++;
      } else {
        throw new AnalogueExpressionError(`unsupported character ${JSON.stringify(char)}`);
      }
    }
    if (tokens.length > MAX_TOKENS) {
      throw new AnalogueExpressionError(`expression exceeds ${MAX_TOKENS} tokens`);
    }
  }
  tokens.push({ kind: 'end' });
  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ExpressionNode {
    const result = this.additive();
    if (this.current().kind !== 'end') {
      throw new AnalogueExpressionError('unexpected trailing input');
    }
    return result;
  }

  private current(): Token {
    return this.tokens[this.index]!;
  }

  private take(): Token {
    return this.tokens[this.index++]!;
  }

  private operator(value: string): boolean {
    const token = this.current();
    if (token.kind !== 'operator' || token.value !== value) return false;
    this.index++;
    return true;
  }

  private additive(): ExpressionNode {
    let left = this.multiplicative();
    while (true) {
      if (this.operator('+')) {
        left = { kind: 'binary', operator: '+', left, right: this.multiplicative() };
      } else if (this.operator('-')) {
        left = { kind: 'binary', operator: '-', left, right: this.multiplicative() };
      } else {
        return left;
      }
    }
  }

  private multiplicative(): ExpressionNode {
    let left = this.unary();
    while (true) {
      if (this.operator('*')) {
        left = { kind: 'binary', operator: '*', left, right: this.unary() };
      } else if (this.operator('/')) {
        left = { kind: 'binary', operator: '/', left, right: this.unary() };
      } else if (this.operator('%')) {
        left = { kind: 'binary', operator: '%', left, right: this.unary() };
      } else {
        return left;
      }
    }
  }

  private unary(): ExpressionNode {
    if (this.operator('+')) return { kind: 'unary', operator: '+', value: this.unary() };
    if (this.operator('-')) return { kind: 'unary', operator: '-', value: this.unary() };
    return this.power();
  }

  private power(): ExpressionNode {
    const left = this.primary();
    return this.operator('**')
      ? { kind: 'binary', operator: '**', left, right: this.unary() }
      : left;
  }

  private primary(): ExpressionNode {
    const token = this.take();
    if (token.kind === 'number') return { kind: 'number', value: token.value };
    if (token.kind === 'left') {
      const value = this.additive();
      if (this.take().kind !== 'right') {
        throw new AnalogueExpressionError('missing closing parenthesis');
      }
      return value;
    }
    if (token.kind !== 'identifier') {
      throw new AnalogueExpressionError('expected a number, variable, or function');
    }
    if (this.current().kind !== 'left') {
      return { kind: 'variable', name: token.value };
    }
    this.take();
    const arguments_: ExpressionNode[] = [];
    if (this.current().kind !== 'right') {
      while (true) {
        arguments_.push(this.additive());
        if (this.current().kind !== 'comma') break;
        this.take();
      }
    }
    if (this.take().kind !== 'right') {
      throw new AnalogueExpressionError('missing closing function parenthesis');
    }
    return { kind: 'call', name: token.value, arguments: arguments_ };
  }
}

function finite(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_ABS_RESULT) {
    throw new AnalogueExpressionError('expression result is non-finite or out of range');
  }
  return value;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
  };
}

function hashSource(source: string): number {
  let hash = 2_166_136_261;
  for (const char of source) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function expressionSeed(source: string, documentSeed?: number): number {
  const normalized = Number.isInteger(documentSeed)
    ? (documentSeed as number) >>> 0
    : 0;
  return (hashSource(source) ^ normalized) >>> 0;
}

function evaluateNode(
  node: ExpressionNode,
  variables: Record<string, number>,
  random: () => number,
): number {
  if (node.kind === 'number') return node.value;
  if (node.kind === 'variable') {
    if (!Object.prototype.hasOwnProperty.call(variables, node.name)) {
      throw new AnalogueExpressionError(`unknown variable ${node.name}`);
    }
    return variables[node.name]!;
  }
  if (node.kind === 'unary') {
    const value = evaluateNode(node.value, variables, random);
    return finite(node.operator === '-' ? -value : value);
  }
  if (node.kind === 'binary') {
    const left = evaluateNode(node.left, variables, random);
    const right = evaluateNode(node.right, variables, random);
    if (node.operator === '/' && right === 0) {
      throw new AnalogueExpressionError('division by zero');
    }
    if (node.operator === '%' && right === 0) {
      throw new AnalogueExpressionError('modulo by zero');
    }
    const value = node.operator === '+' ? left + right
      : node.operator === '-' ? left - right
        : node.operator === '*' ? left * right
          : node.operator === '/' ? left / right
            : node.operator === '%' ? left % right
              : left ** right;
    return finite(value);
  }
  const args = node.arguments.map((argument) => evaluateNode(argument, variables, random));
  if (node.name === 'rnd' && args.length === 0) return random();
  const unaryFunctions: Record<string, (value: number) => number> = {
    exp: Math.exp,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    tanh: Math.tanh,
    sqrt: Math.sqrt,
  };
  const unary = unaryFunctions[node.name];
  if (unary && args.length === 1) return finite(unary(args[0]!));
  if (node.name === 'atan2' && args.length === 2) {
    return finite(Math.atan2(args[0]!, args[1]!));
  }
  throw new AnalogueExpressionError(`unsupported function or argument count: ${node.name}`);
}

function parseExpression(source: string): ExpressionNode {
  return new Parser(tokenize(source)).parse();
}

function sequenceExpressionBody(source: string): { body: string; count: number } {
  if (source.length > ANALOGUE_EXPRESSION_MAX_LENGTH) {
    throw new AnalogueExpressionError(
      `expression must contain 1 to ${ANALOGUE_EXPRESSION_MAX_LENGTH} characters`,
    );
  }
  const match = source.trim().match(
    /^\[\s*([\s\S]+?)\s+for\s+i\s+in\s+range\(\s*(\d+)\s*\)\s*\]$/,
  );
  if (!match) {
    throw new AnalogueExpressionError(
      'generated sequences must use [expression for i in range(N)]',
    );
  }
  const count = Number(match[2]);
  if (!Number.isSafeInteger(count) || count < 0 || count > UNDULATE_SEQUENCE_MAX_VALUES) {
    throw new AnalogueExpressionError(
      `generated sequence length must be from 0 to ${UNDULATE_SEQUENCE_MAX_VALUES}`,
    );
  }
  return { body: match[1]!, count };
}

function rejectSequenceRandom(): number {
  throw new AnalogueExpressionError('rnd() is not supported in generated sequences');
}

export function evaluateAnalogueScalar(
  source: string,
  context: AnalogueContext,
  extraVariables: Record<string, number> = {},
  documentSeed?: number,
): number {
  const tree = parseExpression(source.trim());
  return evaluateNode(tree, {
    VDDA: context.vdda,
    VSSA: context.vssa,
    pi: Math.PI,
    ...extraVariables,
  }, seededRandom(expressionSeed(source, documentSeed)));
}

export function evaluateUndulateSequence(
  source: string,
  context: AnalogueContext = DEFAULT_ANALOGUE_CONTEXT,
): number[] {
  const { body, count } = sequenceExpressionBody(source);
  const tree = parseExpression(body);
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(evaluateNode(tree, {
      VDDA: context.vdda,
      VSSA: context.vssa,
      pi: Math.PI,
      i,
    }, rejectSequenceRandom));
  }
  return values;
}

export function validateUndulateSequence(
  source: string,
  context: AnalogueContext = DEFAULT_ANALOGUE_CONTEXT,
): string | null {
  try {
    evaluateUndulateSequence(source, context);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'invalid generated sequence';
  }
}

export function curveExpressionBody(source: string): string | null {
  const match = source.trim().match(
    /^\[\s*\(\s*t\s*,\s*([\s\S]+)\s*\)\s+for\s+t\s+in\s+time\s*\]$/,
  );
  return match?.[1]?.trim() || null;
}

export function evaluateAnalogueCurve(
  source: string,
  context: AnalogueContext,
  documentSeed?: number,
): Array<[number, number]> {
  const body = curveExpressionBody(source);
  if (!body) {
    throw new AnalogueExpressionError(
      'arbitrary analogue expressions must use [(t, expression) for t in time]',
    );
  }
  const tree = parseExpression(body);
  const random = seededRandom(expressionSeed(source, documentSeed));
  const points: Array<[number, number]> = [];
  for (let t = 0; t <= ANALOGUE_CURVE_INTERVALS; t++) {
    const value = evaluateNode(tree, {
      VDDA: context.vdda,
      VSSA: context.vssa,
      Tmax: ANALOGUE_CURVE_INTERVALS,
      t,
      pi: Math.PI,
    }, random);
    points.push([t / ANALOGUE_CURVE_INTERVALS, value]);
  }
  return points;
}

export function validateAnalogueExpression(
  source: string,
  kind: 'scalar' | 'curve',
  context: AnalogueContext = DEFAULT_ANALOGUE_CONTEXT,
): string | null {
  try {
    if (kind === 'curve') evaluateAnalogueCurve(source, context);
    else evaluateAnalogueScalar(source, context);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'invalid analogue expression';
  }
}
