/**
 * Symbol table: a structure separate from the lexer. It is built from the token stream.
 * Name, token, type, value and the line where the name first appears.
 * Educational scope: types come only from `int`, `float`, `char` declarations; values only from integer literals.
 */
import type { Token } from './lexer';
import { TraceRecorder, type Traced } from './types';

export interface SymbolEntry { name: string; token: 'IDENTIFIER'; type: string; value: string | null; line: number }
const TYPES = ['int', 'float', 'char'];

export function buildSymbolTable(tokens: Token[]): Traced<SymbolEntry[]> {
  const rec = new TraceRecorder();
  const table = new Map<string, SymbolEntry>();
  const literalAfter = (i: number): string | null => {
    const [eq, num, end] = [tokens[i], tokens[i + 1], tokens[i + 2]];
    return eq?.type === 'ASSIGNMENT' && num?.type === 'INTEGER' && (end?.type === 'SEMICOLON' || end?.type === 'COMMA') ? num.lexeme : null;
  };
  tokens.forEach((t, i) => {
    if (t.type !== 'IDENTIFIER') return;
    const prev = tokens[i - 1];
    const declaredType = prev?.type === 'KEYWORD' && TYPES.includes(prev.lexeme) ? prev.lexeme : null;
    const existing = table.get(t.lexeme);
    const literal = literalAfter(i + 1);
    if (declaredType) {
      if (existing) { rec.push('duplicate', { name: t.lexeme, line: t.line, tokenIndex: i, firstLine: existing.line }); return; }
      const entry: SymbolEntry = { name: t.lexeme, token: 'IDENTIFIER', type: declaredType, value: literal, line: t.line };
      table.set(t.lexeme, entry);
      rec.push('declare', { ...entry, tokenIndex: i });
      return;
    }
    if (!existing) {
      const entry: SymbolEntry = { name: t.lexeme, token: 'IDENTIFIER', type: 'undeclared', value: null, line: t.line };
      table.set(t.lexeme, entry);
      rec.push('undeclared', { ...entry, tokenIndex: i });
    } else {
      rec.push('lookup', { name: t.lexeme, line: t.line, tokenIndex: i, type: existing.type });
    }
    if (literal !== null) {
      (table.get(t.lexeme) as SymbolEntry).value = literal;
      rec.push('update', { name: t.lexeme, value: literal, line: t.line, tokenIndex: i });
    }
  });
  return { result: [...table.values()].map((e) => ({ ...e })), steps: rec.steps };
}

/** Rebuild the table from the trace alone. */
export function replaySymbolTrace(steps: { kind: string; payload: Record<string, unknown> }[]): SymbolEntry[] {
  const table = new Map<string, SymbolEntry>();
  for (const s of steps) {
    const p = s.payload;
    if (s.kind === 'declare' || s.kind === 'undeclared') {
      table.set(p.name as string, { name: p.name as string, token: 'IDENTIFIER', type: p.type as string, value: p.value as string | null, line: p.line as number });
    } else if (s.kind === 'update') (table.get(p.name as string) as SymbolEntry).value = p.value as string;
  }
  return [...table.values()];
}
