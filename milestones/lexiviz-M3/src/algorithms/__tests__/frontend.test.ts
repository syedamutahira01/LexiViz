import { describe, expect, it } from 'vitest';
import { buildSymbolTable, lex, parseProgram, replayLexTrace, replaySymbolTrace, treeFromTrace, type ParseNode } from '..';

const types = (src: string) => lex(src).result.tokens.map((t) => t.type);
const lexemes = (src: string) => lex(src).result.tokens.map((t) => t.lexeme);

describe('lexer', () => {
  it('int total = 25; gives KEYWORD IDENTIFIER ASSIGNMENT INTEGER SEMICOLON', () => {
    expect(types('int total = 25;')).toEqual(['KEYWORD', 'IDENTIFIER', 'ASSIGNMENT', 'INTEGER', 'SEMICOLON']);
    expect(lexemes('int total = 25;')).toEqual(['int', 'total', '=', '25', ';']);
  });
  it('keywords are only whole words: int vs integer vs int_x vs int2', () => {
    expect(types('int')).toEqual(['KEYWORD']);
    expect(types('integer')).toEqual(['IDENTIFIER']);
    expect(types('int_x')).toEqual(['IDENTIFIER']);
    expect(types('int2')).toEqual(['IDENTIFIER']);
    expect(types('_a1 B2')).toEqual(['IDENTIFIER', 'IDENTIFIER']);
  });
  it('longest match: == beats =, <= beats <, and = = stays two tokens', () => {
    expect(lexemes('a==b')).toEqual(['a', '==', 'b']);
    expect(lexemes('a<=b')).toEqual(['a', '<=', 'b']);
    expect(lexemes('a = = b')).toEqual(['a', '=', '=', 'b']);
    expect(types('x=1')).toEqual(['IDENTIFIER', 'ASSIGNMENT', 'INTEGER']);
  });
  it('digits followed by letters split into INTEGER then IDENTIFIER (longest match, no backtracking)', () => {
    expect(types('12abc')).toEqual(['INTEGER', 'IDENTIFIER']);
  });
  it('records the candidates and picks the earlier rule on a tie', () => {
    const t = lex('int').steps[0]!;
    const cands = t.payload.candidates as { rule: string; length: number }[];
    expect(cands.map((c) => c.rule)).toEqual(['KEYWORD', 'IDENTIFIER']);
    expect(t.payload.rule).toBe('KEYWORD');
    const eq = lex('==').steps[0]!;
    expect((eq.payload.candidates as { length: number }[]).map((c) => c.length)).toEqual([2, 1]);
    expect(eq.payload.rule).toBe('OPERATOR (two characters)');
  });
  it('tracks line and column (1-based) across lines', () => {
    const { tokens } = lex('int a;\n  b = 7;').result;
    expect(tokens.map((t) => [t.lexeme, t.line, t.column])).toEqual([
      ['int', 1, 1], ['a', 1, 5], [';', 1, 6], ['b', 2, 3], ['=', 2, 5], ['7', 2, 7], [';', 2, 8],
    ]);
    expect(tokens[0]).toMatchObject({ start: 0, end: 3 });
  });
  it('handles Windows line endings without shifting columns', () => {
    const { tokens } = lex('a;\r\nb;').result;
    expect(tokens.map((t) => [t.lexeme, t.line, t.column])).toEqual([['a', 1, 1], [';', 1, 2], ['b', 2, 1], [';', 2, 2]]);
  });
  it('reports the end-of-source position, ignoring a trailing carriage return', () => {
    expect(lex('ab').result.end).toEqual({ line: 1, column: 3 });
    expect(lex('a\r').result.end).toEqual({ line: 1, column: 2 });
    expect(lex('a\nbc').result.end).toEqual({ line: 2, column: 3 });
  });
  it('reports unexpected characters with positions and keeps scanning', () => {
    const { result } = lex('int a = 5 @ 6;\n# b');
    expect(result.errors.map((e) => [e.char, e.line, e.column])).toEqual([['@', 1, 11], ['#', 2, 1]]);
    expect(result.errors[0]?.message).toBe("Unexpected character '@'");
    expect(result.tokens.map((t) => t.lexeme)).toEqual(['int', 'a', '=', '5', '6', ';', 'b']);
  });
  it('a lone ! is an error, != is an operator', () => {
    expect(lex('!').result.errors).toHaveLength(1);
    expect(types('a != b')).toEqual(['IDENTIFIER', 'OPERATOR', 'IDENTIFIER']);
  });
  it('empty and whitespace-only sources give no tokens and no errors', () => {
    for (const src of ['', '   \n\t ']) {
      const { result } = lex(src);
      expect(result.tokens).toEqual([]);
      expect(result.errors).toEqual([]);
    }
  });
  it('trace replay reproduces tokens and errors', () => {
    for (const src of ['int total = 25;', 'x = (1 + 2) * 3;\n y @ 4', '', 'a==b != c']) {
      const t = lex(src);
      const replay = replayLexTrace(t.steps);
      expect(replay.tokens).toEqual(t.result.tokens);
      expect(replay.errors).toEqual(t.result.errors);
    }
  });
});

describe('symbol table', () => {
  const table = (src: string) => buildSymbolTable(lex(src).result.tokens);
  it('records name, token, type, value and line', () => {
    const { result } = table('int total = 25;\nfloat price;\nchar c = 7;');
    expect(result).toEqual([
      { name: 'total', token: 'IDENTIFIER', type: 'int', value: '25', line: 1 },
      { name: 'price', token: 'IDENTIFIER', type: 'float', value: null, line: 2 },
      { name: 'c', token: 'IDENTIFIER', type: 'char', value: '7', line: 3 },
    ]);
  });
  it('updates a value on a later assignment but keeps the declaration line', () => {
    const { result } = table('int x;\nx = 9;');
    expect(result).toEqual([{ name: 'x', token: 'IDENTIFIER', type: 'int', value: '9', line: 1 }]);
  });
  it('does not store a value for a computed expression', () => {
    expect(table('int x = 1 + 2;').result[0]?.value).toBeNull();
  });
  it('flags use before declaration and ignores duplicate declarations', () => {
    expect(table('y = 3;').result).toEqual([{ name: 'y', token: 'IDENTIFIER', type: 'undeclared', value: '3', line: 1 }]);
    const dup = table('int a = 1;\nint a = 2;');
    expect(dup.result).toHaveLength(1);
    expect(dup.result[0]?.value).toBe('1');
    expect(dup.steps.map((s) => s.kind)).toEqual(['declare', 'duplicate']);
  });
  it('keywords and numbers never enter the table', () => {
    expect(table('int 5;').result).toEqual([]);
  });
  it('trace replay reproduces the table', () => {
    for (const src of ['int total = 25;\nfloat p;\np = 3;\nq = 1;', 'int a;\nint a;']) {
      const t = table(src);
      expect(replaySymbolTrace(t.steps)).toEqual(t.result);
    }
  });
});

const parse = (src: string) => {
  const l = lex(src).result;
  return parseProgram(l.tokens, l.end);
};
/** Evaluate a parse tree the way the grammar says, to compare with JavaScript's own arithmetic. */
function evalNode(n: ParseNode, vars: Record<string, number> = {}): number {
  const apply = (op: string, a: number, b: number) => (op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b);
  if (n.kind === 'token') return n.token!.type === 'INTEGER' ? Number(n.token!.lexeme) : (vars[n.token!.lexeme] as number);
  if (n.label === 'Factor') return n.children.length === 3 ? evalNode(n.children[1]!, vars) : evalNode(n.children[0]!, vars);
  let acc = evalNode(n.children[0]!, vars);
  for (let i = 1; i < n.children.length; i += 2) acc = apply(n.children[i]!.token!.lexeme, acc, evalNode(n.children[i + 1]!, vars));
  return acc;
}
const exprOf = (tree: ParseNode) => tree.children[0]!.children[0]!.children.find((c) => c.label === 'Expr')!;

describe('parser', () => {
  it('parses x = 10 + 20; into Program > Statement > Assignment > Expr', () => {
    const { result } = parse('x = 10 + 20;');
    expect(result.error).toBeNull();
    const assign = result.tree.children[0]!.children[0]!;
    expect(assign.label).toBe('Assignment');
    expect(assign.children.map((c) => c.label)).toEqual(["IDENTIFIER 'x'", "ASSIGNMENT '='", 'Expr', "SEMICOLON ';'"]);
    expect(exprOf(result.tree).children.map((c) => c.label)).toEqual(['Term', "OPERATOR '+'", 'Term']);
  });
  it('parses a declaration with and without an initialiser', () => {
    expect(parse('int n;').result.error).toBeNull();
    expect(parse('int n = 4 * (2 + 3);').result.error).toBeNull();
  });
  it('an empty program is valid', () => {
    const { result } = parse('');
    expect(result.error).toBeNull();
    expect(result.tree.children).toEqual([]);
  });
  it('multiple statements', () => {
    expect(parse('int a = 1; int b = 2; a = a + b;').result.tree.children).toHaveLength(3);
  });
  it.each(['1 + 2 * 3', '(1 + 2) * 3', '10 - 3 - 2', '8 / 4 / 2', '2 * 3 + 4 * 5', '((7))', '100 - 4 * (2 + 3) / 5', '1 + 2 - 3 + 4'])(
    'respects precedence and associativity: %s',
    (expr) => {
      const { result } = parse(`x = ${expr};`);
      expect(result.error).toBeNull();
      expect(evalNode(exprOf(result.tree))).toBe(Function(`return ${expr}`)());
    },
  );
  it('looks variables up when evaluating', () => {
    const { result } = parse('r = a * b + 1;');
    expect(evalNode(exprOf(result.tree), { a: 6, b: 7 })).toBe(43);
  });
  it('multiplication sits deeper in the tree than addition', () => {
    const e = exprOf(parse('x = 1 + 2 * 3;').result.tree);
    const secondTerm = e.children[2]!;
    expect(secondTerm.children.map((c) => c.label)).toEqual(['Factor', "OPERATOR '*'", 'Factor']);
    expect(e.children[0]!.children).toHaveLength(1);
  });
  it.each([
    ['x = 10 + 20', "expected ';' but found end of input", 1, 12],
    ['int = 5;', 'expected a variable name after the type but found', 1, 5],
    ['x 10;', "expected '=' after the variable name but found '10'", 1, 3],
    ['x = ;', "expected a number, a variable or '(' but found ';'", 1, 5],
    ['x = (1 + 2;', "expected ')' but found ';'", 1, 11],
    ['x = 1 +;', 'expected a number', 1, 8],
    ['5 = x;', 'expected a declaration or an assignment but found', 1, 1],
    ['if (x) y = 1;', "keyword 'if' is not supported", 1, 1],
    ['int a = 1;\nint b = ;', 'expected a number', 2, 9],
  ])('syntax error in %j', (src, message, line, column) => {
    const { result } = parse(src);
    expect(result.error?.message).toContain(message);
    expect(result.error).toMatchObject({ line, column });
  });
  it('keeps the partial tree up to the error', () => {
    const { result, steps } = parse('x = 1 +;');
    expect(result.error).not.toBeNull();
    expect(treeFromTrace(steps)).toEqual(result.tree);
    expect(steps.at(-2)?.kind).toBe('error');
  });
  it('trace replay reproduces the parse tree, and the tree grows in call order', () => {
    for (const src of ['x = 10 + 20;', 'int a = (1 + 2) * 3; a = a - 1;', 'int n;']) {
      const t = parse(src);
      expect(treeFromTrace(t.steps)).toEqual(t.result.tree);
    }
    const t = parse('x = 1;');
    const order = t.steps.filter((s) => s.kind === 'enter' || s.kind === 'match').map((s) => (s.kind === 'enter' ? s.payload.rule : s.payload.lexeme));
    expect(order).toEqual(['Program', 'Statement', 'Assignment', 'x', '=', 'Expr', 'Term', 'Factor', '1', ';']);
    // the partial tree after 3 steps already has the first three rules nested
    expect(treeFromTrace(t.steps, 3)?.children[0]?.children[0]?.label).toBe('Assignment');
  });
});
