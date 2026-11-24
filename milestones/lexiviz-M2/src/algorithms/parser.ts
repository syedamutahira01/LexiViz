/**
 * Recursive-descent parser for a small grammar. Output is a parse tree (every rule that was entered, every token matched).
 *   Program     -> Statement*
 *   Statement   -> Declaration | Assignment
 *   Declaration -> TYPE IDENTIFIER ('=' Expr)? ';'
 *   Assignment  -> IDENTIFIER '=' Expr ';'
 *   Expr        -> Term (('+' | '-') Term)*          left associative
 *   Term        -> Factor (('*' | '/') Factor)*      binds tighter than Expr
 *   Factor      -> INTEGER | IDENTIFIER | '(' Expr ')'
 * This is not a C parser: no if/while, no functions, no comparison operators in expressions.
 * The parser stops at the first syntax error and reports its line and column.
 */
import type { Token } from './lexer';
import { TraceRecorder, type StepEvent, type Traced } from './types';

export interface ParseNode { id: number; kind: 'rule' | 'token'; label: string; token?: Token; children: ParseNode[] }
export interface ParseError { message: string; line: number; column: number; tokenIndex: number }
export interface ParseResult { tree: ParseNode; error: ParseError | null }

class Fail extends Error { constructor(readonly error: ParseError) { super(error.message); } }
const TYPES = ['int', 'float', 'char'];

export function parseProgram(tokens: Token[], end: { line: number; column: number } = { line: 1, column: 1 }): Traced<ParseResult> {
  const rec = new TraceRecorder();
  let nextId = 0, pos = 0;
  const stack: ParseNode[] = [];
  let root: ParseNode | null = null;

  const cur = (): Token | undefined => tokens[pos];
  const describe = () => (cur() ? `'${(cur() as Token).lexeme}'` : 'end of input');
  const isOp = (...ops: string[]) => cur()?.type === 'OPERATOR' && ops.includes((cur() as Token).lexeme);

  const enter = (rule: string) => {
    const node: ParseNode = { id: nextId++, kind: 'rule', label: rule, children: [] };
    const parent = stack[stack.length - 1];
    parent?.children.push(node);
    if (!root) root = node;
    stack.push(node);
    rec.push('enter', { id: node.id, rule, parent: parent?.id ?? null, tokenIndex: pos, lookahead: cur()?.lexeme ?? null });
  };
  const exit = () => {
    const node = stack.pop() as ParseNode;
    rec.push('exit', { id: node.id, rule: node.label });
  };
  const take = () => {
    const t = tokens[pos] as Token;
    const parent = stack[stack.length - 1] as ParseNode;
    const node: ParseNode = { id: nextId++, kind: 'token', label: `${t.type} '${t.lexeme}'`, token: t, children: [] };
    parent.children.push(node);
    rec.push('match', { id: node.id, parent: parent.id, tokenIndex: pos, ...t });
    pos++;
  };
  const fail = (message: string): never => {
    const at = cur() ?? end;
    const error: ParseError = { message, line: at.line, column: at.column, tokenIndex: pos };
    rec.push('error', { ...error });
    throw new Fail(error);
  };

  const factor = () => {
    enter('Factor');
    const t = cur();
    if (t?.type === 'INTEGER' || t?.type === 'IDENTIFIER') take();
    else if (t?.type === 'LPAREN') {
      take(); expr();
      if (cur()?.type === 'RPAREN') take(); else fail(`expected ')' but found ${describe()}`);
    } else fail(`expected a number, a variable or '(' but found ${describe()}`);
    exit();
  };
  const term = () => { enter('Term'); factor(); while (isOp('*', '/')) { take(); factor(); } exit(); };
  const expr = () => { enter('Expr'); term(); while (isOp('+', '-')) { take(); term(); } exit(); };
  const semicolon = () => { if (cur()?.type === 'SEMICOLON') take(); else fail(`expected ';' but found ${describe()}`); };
  const declaration = () => {
    enter('Declaration'); take();
    if (cur()?.type === 'IDENTIFIER') take(); else fail(`expected a variable name after the type but found ${describe()}`);
    if (cur()?.type === 'ASSIGNMENT') { take(); expr(); }
    semicolon(); exit();
  };
  const assignment = () => {
    enter('Assignment'); take();
    if (cur()?.type === 'ASSIGNMENT') take(); else fail(`expected '=' after the variable name but found ${describe()}`);
    expr(); semicolon(); exit();
  };
  const statement = () => {
    enter('Statement');
    const t = cur() as Token;
    if (t.type === 'KEYWORD' && TYPES.includes(t.lexeme)) declaration();
    else if (t.type === 'IDENTIFIER') assignment();
    else if (t.type === 'KEYWORD') fail(`keyword '${t.lexeme}' is not supported by this small grammar`);
    else fail(`expected a declaration or an assignment but found ${describe()}`);
    exit();
  };

  let error: ParseError | null = null;
  try {
    enter('Program');
    while (cur()) statement();
    exit();
    rec.push('done', { ok: true });
  } catch (e) {
    if (!(e instanceof Fail)) throw e;
    error = e.error;
    rec.push('done', { ok: false });
  }
  return { result: { tree: root as unknown as ParseNode, error }, steps: rec.steps };
}

/** Rebuild the (partial) parse tree from the first `upto` steps. The tree grows in the order of the recursive calls. */
export function treeFromTrace(steps: StepEvent[], upto = steps.length): ParseNode | null {
  const nodes = new Map<number, ParseNode>();
  let root: ParseNode | null = null;
  for (const s of steps.slice(0, upto)) {
    const p = s.payload;
    if (s.kind === 'enter') {
      const node: ParseNode = { id: p.id as number, kind: 'rule', label: p.rule as string, children: [] };
      nodes.set(node.id, node);
      if (p.parent === null) root = node; else nodes.get(p.parent as number)?.children.push(node);
    } else if (s.kind === 'match') {
      const token: Token = { type: p.type as Token['type'], lexeme: p.lexeme as string, line: p.line as number, column: p.column as number, start: p.start as number, end: p.end as number };
      const node: ParseNode = { id: p.id as number, kind: 'token', label: `${token.type} '${token.lexeme}'`, token, children: [] };
      nodes.set(node.id, node);
      nodes.get(p.parent as number)?.children.push(node);
    }
  }
  return root;
}
