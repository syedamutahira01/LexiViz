# LexiViz

A browser-based educational tool that visualizes Automata Theory and Compiler Construction. Every graph, tree and table is produced by the real algorithm, and the screen only reads the step trace the algorithm returns.

**Status: milestone M2 (core automata, lexer, symbol table, parser).** The 3D scene, music and narration are later milestones (M3 to M5).

## Features (M1 and M2)
- Regex tokenizer and recursive-descent parser with a token table and a growing AST view
- Thompson construction (regex to NFA), stepped fragment by fragment
- Subset construction (NFA to DFA) showing ε-closure, move and the NFA states behind each DFA state
- DFA minimization by partition refinement, with the partition shown per round
- String acceptance with Play, Pause, Next, Previous, Reset and speed control
- Exact error positions for invalid regexes; empty input and unknown test symbols handled without crashing
- Lexer Lab: rule-based longest-match lexer with line and column numbers, candidate rules shown per lexeme, token table, symbol table, lexical errors with positions
- Parser Lab: recursive-descent parser for declarations, assignments and arithmetic; the parse tree grows in the order of the recursive calls; syntax errors show line, column and a caret

## Stack
React, TypeScript (strict), Vite, react-router-dom, @xyflow/react (React Flow), lucide-react. Dev: Vitest, Testing Library, happy-dom, oxlint. No backend. three, @react-three/fiber and drei are added in M3.

## Install and run (PowerShell or any shell)
```
npm install
npm run dev
```
Other commands: `npm run test`, `npm run typecheck` (`npx tsc -b --noEmit`), `npm run lint`, `npm run build`.

## Architecture
```
src/algorithms/   pure TypeScript, never imports React or three
  types.ts        StepEvent, Traced<T>, TraceRecorder  (the trace contract)
  automata.ts     Nfa, Dfa (enforces determinism), IdGenerator, EPSILON
  regex.ts        tokenizer, recursive-descent parser, RegexSyntaxError
  thompson.ts     regex AST -> NFA
  subset.ts       NFA -> DFA (epsilonClosure, move)
  minimize.ts     DFA -> minimal DFA
  accept.ts       run a string through a DFA
  lexer.ts        rule-based longest-match lexer
  symbols.ts      symbol table built from tokens
  parser.ts       recursive-descent parser, parse tree
src/visual/       layout, trace explanations, AST forest: read traces only
src/components/   Graph (React Flow), Stepper
src/pages/        Automata Lab and the other pages
```
Each algorithm returns `{ result, steps }`. Steps are plain data (`{ index, kind, payload }`). Tests prove replaying a trace reproduces the result.

## Algorithms (viva notes)
- **Regex syntax:** literal symbols, concatenation, `|`, `*`, parentheses, `ε`, `()` and the empty pattern. Precedence: star, then concatenation, then alternation. Reserved: `| * ( ) ε`. Not supported: classes, `+`, `?`, escapes, whitespace. Errors throw `RegexSyntaxError` with a message and a character position.
- **Grammar:** `Alt -> Concat ('|' Concat)*`, `Concat -> Star+`, `Star -> Atom '*'*`, `Atom -> symbol | ε | '(' Alt? ')'`.
- **Thompson:** each fragment has one start and one accept state. Concatenation bridges with an ε edge. Union and star add a new start and accept state with ε edges. Only the final accept state is accepting. Invariants tested: exactly one accept state, no edge into the start state, no edge out of the accept state.
- **Subset construction:** DFA state = set of NFA states. Start = ε-closure of the NFA start. For each symbol: move, then ε-closure. A DFA state accepts if it contains the NFA accept state.
- **Minimization:** remove unreachable states, split accepting vs non-accepting, refine until no group splits, merge groups. A missing transition counts as an implicit dead state.
- **Lexer:** every rule is tried at the current position. The longest match wins; on a tie the rule listed first wins, which is why `int` is a KEYWORD and `integer` is an IDENTIFIER (that rule matches 7 characters against 3). `==` beats `=` for the same reason. Digits followed by letters (`12abc`) become INTEGER then IDENTIFIER, as in real lexers. An unexpected character is reported with line and column and skipped, so scanning continues.
- **Symbol table:** name, token, type, value, line. A type comes only from an `int`, `float` or `char` declaration; a value only from an integer literal. Use before declaration is recorded as type `undeclared`; a second declaration is ignored and traced as a duplicate. It is a separate structure from the lexer.
- **Parser grammar:** `Program -> Statement*`, `Statement -> Declaration | Assignment`, `Declaration -> TYPE IDENT ('=' Expr)? ';'`, `Assignment -> IDENT '=' Expr ';'`, `Expr -> Term (('+'|'-') Term)*`, `Term -> Factor (('*'|'/') Factor)*`, `Factor -> INTEGER | IDENT | '(' Expr ')'`. Precedence comes from the grammar levels: Term sits below Expr, so `*` groups before `+`. The output is a parse tree (every rule entered and every token matched). The parser stops at the first syntax error. It is not a C parser.
- **Lexer vs automata:** regular expressions and finite automata are the theory behind lexical patterns. The lexer (M2) uses pattern rules to produce tokens. The symbol table is a separate structure.

## Testing
`npm run test` runs 112 tests. The parse trees are checked by evaluating them and comparing with JavaScript's own arithmetic (precedence, associativity, parentheses). The automaton tests compare every string up to length 6 against JavaScript's own `RegExp` as an independent oracle, for both the DFA and the minimized DFA. The UI tests stub the graph component (happy-dom cannot lay out React Flow); graph rendering was checked in a real browser with Playwright.

## Assumptions
- The empty pattern means ε in the algorithms; the Automata Lab asks the user to type something and suggests `ε`.
- Whitespace in a regex is rejected rather than ignored, so error positions stay exact.
- The DFA is partial (no dead state drawn).

## Known limitations
- 3D, music and narration are not built yet (M3 to M5).
- The lexer has no comments, strings or decimals. The parser has no if/while, functions or comparison operators in expressions, and stops at the first error.
- Parsing is blocked while the lexer reports invalid characters.
- On some DFAs a long edge label can sit close to another label; the layout is a simple layered one.
- UI tests do not exercise React Flow itself.

## Future improvements
Milestones M3 to M6 of the build prompt.
