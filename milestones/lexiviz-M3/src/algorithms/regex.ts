/**
 * Regex front end.
 * Supported syntax: literal symbols, concatenation, alternation '|', Kleene star '*',
 * parentheses, and epsilon (empty pattern, '()' or 'ε').
 * Precedence: star > concatenation > alternation. Reserved characters: | * ( ) ε
 * NOT supported: character classes, '+', '?', escapes, whitespace.
 */
import { TraceRecorder, type Traced } from './types';

export class RegexSyntaxError extends Error {
  constructor(message: string, readonly position: number) {
    super(`Invalid regular expression: ${message}`);
    this.name = 'RegexSyntaxError';
  }
}

export type RegexTokenType = 'symbol' | 'epsilon' | 'union' | 'star' | 'lparen' | 'rparen';
export interface RegexToken {
  type: RegexTokenType;
  value: string;
  position: number;
}

export type AstNode =
  | { id: number; type: 'symbol'; value: string }
  | { id: number; type: 'epsilon' }
  | { id: number; type: 'concat'; left: AstNode; right: AstNode }
  | { id: number; type: 'union'; left: AstNode; right: AstNode }
  | { id: number; type: 'star'; child: AstNode };

export function tokenize(input: string): RegexToken[] {
  const tokens: RegexToken[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i] as string;
    if (/\s/.test(ch)) throw new RegexSyntaxError('whitespace is not supported, remove the space', i);
    if (ch === '\\') throw new RegexSyntaxError('escape sequences are not supported', i);
    if (ch === '+' || ch === '?') {
      throw new RegexSyntaxError(`'${ch}' is not supported (use ${ch === '+' ? 'aa*' : '(a|ε)'} style rewrites)`, i);
    }
    if (ch === '[' || ch === ']' || ch === '.') {
      throw new RegexSyntaxError(`'${ch}' is not supported (no character classes or wildcards)`, i);
    }
    const type: RegexTokenType =
      ch === '|' ? 'union' : ch === '*' ? 'star' : ch === '(' ? 'lparen' : ch === ')' ? 'rparen' : ch === 'ε' ? 'epsilon' : 'symbol';
    tokens.push({ type, value: ch, position: i });
  }
  return tokens;
}

/** Recursive descent: Alternation -> Concatenation ('|' Concatenation)*, Concatenation -> Star+, Star -> Atom '*'*, Atom -> symbol | ε | '(' Alternation? ')' */
export function parseRegex(input: string): Traced<AstNode> {
  const tokens = tokenize(input);
  const rec = new TraceRecorder();
  for (const t of tokens) rec.push('token', { type: t.type, value: t.value, position: t.position });

  let pos = 0;
  let nextId = 0;
  const peek = () => tokens[pos];
  const endPos = input.length;

  const emit = (node: AstNode): AstNode => {
    const payload: Record<string, unknown> = { id: node.id, type: node.type };
    if (node.type === 'symbol') payload.value = node.value;
    if (node.type === 'concat' || node.type === 'union') payload.children = [node.left.id, node.right.id];
    if (node.type === 'star') payload.children = [node.child.id];
    rec.push('node', payload);
    return node;
  };

  const startsAtom = (t: RegexToken | undefined) => t !== undefined && (t.type === 'symbol' || t.type === 'epsilon' || t.type === 'lparen');

  function parseAtom(): AstNode {
    const t = peek() as RegexToken;
    if (t.type === 'symbol') {
      pos++;
      return emit({ id: nextId++, type: 'symbol', value: t.value });
    }
    if (t.type === 'epsilon') {
      pos++;
      return emit({ id: nextId++, type: 'epsilon' });
    }
    // lparen
    pos++;
    if (peek()?.type === 'rparen') {
      pos++;
      return emit({ id: nextId++, type: 'epsilon' });
    }
    if (peek() === undefined) throw new RegexSyntaxError('missing closing parenthesis', t.position);
    const inner = parseAlternation();
    const close = peek();
    if (close?.type !== 'rparen') throw new RegexSyntaxError('missing closing parenthesis', t.position);
    pos++;
    return inner;
  }

  function parseStar(): AstNode {
    let node = parseAtom();
    while (peek()?.type === 'star') {
      pos++;
      node = emit({ id: nextId++, type: 'star', child: node });
    }
    return node;
  }

  function parseConcat(): AstNode {
    const t = peek();
    if (!startsAtom(t)) {
      if (t?.type === 'star') throw new RegexSyntaxError("'*' has nothing to repeat", t.position);
      throw new RegexSyntaxError('expected an expression', t ? t.position : endPos);
    }
    let node = parseStar();
    while (startsAtom(peek())) {
      const right = parseStar();
      node = emit({ id: nextId++, type: 'concat', left: node, right });
    }
    return node;
  }

  function parseAlternation(): AstNode {
    let node = parseConcat();
    while (peek()?.type === 'union') {
      const bar = peek() as RegexToken;
      pos++;
      const next = peek();
      if (!startsAtom(next)) {
        throw new RegexSyntaxError("missing expression after '|'", next ? next.position : bar.position + 1);
      }
      const right = parseConcat();
      node = emit({ id: nextId++, type: 'union', left: node, right });
    }
    return node;
  }

  let root: AstNode;
  if (tokens.length === 0) {
    root = emit({ id: nextId++, type: 'epsilon' }); // empty pattern means epsilon
  } else {
    root = parseAlternation();
    const rest = peek();
    if (rest) {
      if (rest.type === 'rparen') throw new RegexSyntaxError('unmatched closing parenthesis', rest.position);
      throw new RegexSyntaxError('unexpected token', rest.position);
    }
  }
  rec.push('done', { root: root.id });
  return { result: root, steps: rec.steps };
}

/** Rebuild the AST from a parse trace alone (used by tests to prove the trace is complete). */
export function replayParseTrace(steps: { kind: string; payload: Record<string, unknown> }[]): AstNode {
  const nodes = new Map<number, AstNode>();
  let root = -1;
  for (const s of steps) {
    if (s.kind === 'node') {
      const p = s.payload as { id: number; type: AstNode['type']; value?: string; children?: number[] };
      const get = (i: number) => nodes.get(i) as AstNode;
      let n: AstNode;
      if (p.type === 'symbol') n = { id: p.id, type: 'symbol', value: p.value as string };
      else if (p.type === 'epsilon') n = { id: p.id, type: 'epsilon' };
      else if (p.type === 'star') n = { id: p.id, type: 'star', child: get((p.children as number[])[0] as number) };
      else n = { id: p.id, type: p.type, left: get((p.children as number[])[0] as number), right: get((p.children as number[])[1] as number) };
      nodes.set(p.id, n);
    } else if (s.kind === 'done') root = s.payload.root as number;
  }
  return nodes.get(root) as AstNode;
}

export function astToString(n: AstNode): string {
  switch (n.type) {
    case 'symbol': return n.value;
    case 'epsilon': return 'ε';
    case 'star': return `(${astToString(n.child)})*`;
    case 'concat': return `(${astToString(n.left)}${astToString(n.right)})`;
    case 'union': return `(${astToString(n.left)}|${astToString(n.right)})`;
  }
}
