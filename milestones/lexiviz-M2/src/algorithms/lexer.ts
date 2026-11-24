/**
 * Rule-based lexer with longest match.
 * Every rule is tried at the current position; the longest match wins, and on a tie the rule listed first wins
 * (so `int` is a KEYWORD, not an IDENTIFIER). `integer` is an IDENTIFIER because that rule matches 7 characters
 * against the keyword rule's 3, so no word-boundary check is needed in the keyword pattern.
 * Unexpected characters are reported as errors and skipped, so one bad character does not stop the scan.
 * Not supported: comments, string and character literals, floating-point numbers.
 */
import { TraceRecorder, type Traced } from './types';

export type TokenType =
  | 'KEYWORD' | 'IDENTIFIER' | 'INTEGER' | 'ASSIGNMENT' | 'OPERATOR'
  | 'SEMICOLON' | 'COMMA' | 'LPAREN' | 'RPAREN' | 'LBRACE' | 'RBRACE';

export interface Token { type: TokenType; lexeme: string; line: number; column: number; start: number; end: number }
export interface LexError { char: string; message: string; line: number; column: number; start: number }
export interface LexResult { tokens: Token[]; errors: LexError[]; end: { line: number; column: number } }

interface Rule { id: string; type: TokenType | null; pattern: RegExp }
/** Order matters for ties. The rule id is what the UI shows in the candidate list. */
export const LEX_RULES: readonly Rule[] = [
  { id: 'WHITESPACE', type: null, pattern: /\s+/y },
  { id: 'KEYWORD', type: 'KEYWORD', pattern: /(?:int|float|char|if|else|while|return|for)/y },
  { id: 'IDENTIFIER', type: 'IDENTIFIER', pattern: /[A-Za-z_][A-Za-z0-9_]*/y },
  { id: 'INTEGER', type: 'INTEGER', pattern: /[0-9]+/y },
  { id: 'OPERATOR (two characters)', type: 'OPERATOR', pattern: /==|!=|<=|>=/y },
  { id: 'ASSIGNMENT', type: 'ASSIGNMENT', pattern: /=/y },
  { id: 'OPERATOR (one character)', type: 'OPERATOR', pattern: /[+\-*/<>]/y },
  { id: 'SEMICOLON', type: 'SEMICOLON', pattern: /;/y },
  { id: 'COMMA', type: 'COMMA', pattern: /,/y },
  { id: 'LPAREN', type: 'LPAREN', pattern: /\(/y },
  { id: 'RPAREN', type: 'RPAREN', pattern: /\)/y },
  { id: 'LBRACE', type: 'LBRACE', pattern: /\{/y },
  { id: 'RBRACE', type: 'RBRACE', pattern: /\}/y },
];

export interface Candidate { rule: string; type: TokenType; length: number }

export function lex(source: string): Traced<LexResult> {
  const rec = new TraceRecorder();
  const tokens: Token[] = [];
  const errors: LexError[] = [];
  let pos = 0, line = 1, column = 1;

  const advance = (text: string) => {
    for (const ch of text) {
      if (ch === '\n') { line++; column = 1; } else if (ch !== '\r') column++;
    }
  };

  while (pos < source.length) {
    let best: { rule: Rule; length: number } | null = null;
    const candidates: Candidate[] = [];
    for (const rule of LEX_RULES) {
      rule.pattern.lastIndex = pos;
      const m = rule.pattern.exec(source);
      if (!m || m[0].length === 0) continue;
      if (rule.type) candidates.push({ rule: rule.id, type: rule.type, length: m[0].length });
      if (!best || m[0].length > best.length) best = { rule, length: m[0].length }; // strict > keeps the earlier rule on ties
    }
    if (!best) {
      const ch = String.fromCodePoint(source.codePointAt(pos) as number);
      const err: LexError = { char: ch, message: `Unexpected character '${ch}'`, line, column, start: pos };
      errors.push(err);
      rec.push('error', { ...err });
      pos += ch.length; column++;
      continue;
    }
    const lexeme = source.slice(pos, pos + best.length);
    if (best.rule.type === null) { advance(lexeme); pos += best.length; continue; } // whitespace is skipped silently
    const token: Token = { type: best.rule.type, lexeme, line, column, start: pos, end: pos + best.length };
    tokens.push(token);
    rec.push('token', { ...token, rule: best.rule.id, candidates });
    advance(lexeme); pos += best.length;
  }
  rec.push('done', { tokenCount: tokens.length, errorCount: errors.length });
  return { result: { tokens, errors, end: { line, column } }, steps: rec.steps };
}

/** Rebuild tokens and errors from a lexer trace alone. */
export function replayLexTrace(steps: { kind: string; payload: Record<string, unknown> }[]): { tokens: Token[]; errors: LexError[] } {
  const tokens: Token[] = []; const errors: LexError[] = [];
  for (const s of steps) {
    const p = s.payload;
    if (s.kind === 'token') tokens.push({ type: p.type as TokenType, lexeme: p.lexeme as string, line: p.line as number, column: p.column as number, start: p.start as number, end: p.end as number });
    else if (s.kind === 'error') errors.push({ char: p.char as string, message: p.message as string, line: p.line as number, column: p.column as number, start: p.start as number });
  }
  return { tokens, errors };
}
