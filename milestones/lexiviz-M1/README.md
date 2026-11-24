# LexiViz

A browser-based educational tool that visualizes Automata Theory and Compiler Construction. Every graph, tree and table is produced by the real algorithm, and the screen only reads the step trace the algorithm returns.

**Status: milestone M1 (core automata).** The Lexer Lab, Parser Lab, 3D scene, music and narration are later milestones (M2 to M5).

## Features (M1)
- Regex tokenizer and recursive-descent parser with a token table and a growing AST view
- Thompson construction (regex to NFA), stepped fragment by fragment
- Subset construction (NFA to DFA) showing ε-closure, move and the NFA states behind each DFA state
- DFA minimization by partition refinement, with the partition shown per round
- String acceptance with Play, Pause, Next, Previous, Reset and speed control
- Exact error positions for invalid regexes; empty input and unknown test symbols handled without crashing

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
- **Lexer vs automata:** regular expressions and finite automata are the theory behind lexical patterns. The lexer (M2) uses pattern rules to produce tokens. The symbol table is a separate structure.

## Testing
`npm run test` runs 58 tests. The automaton tests compare every string up to length 6 against JavaScript's own `RegExp` as an independent oracle, for both the DFA and the minimized DFA. The UI tests stub the graph component (happy-dom cannot lay out React Flow); graph rendering was checked in a real browser with Playwright.

## Assumptions
- The empty pattern means ε in the algorithms; the Automata Lab asks the user to type something and suggests `ε`.
- Whitespace in a regex is rejected rather than ignored, so error positions stay exact.
- The DFA is partial (no dead state drawn).

## Known limitations
- The Lexer Lab, Parser Lab, 3D, music and narration are not built yet.
- On some DFAs a long edge label can sit close to another label; the layout is a simple layered one.
- UI tests do not exercise React Flow itself.

## Future improvements
Milestones M2 to M6 of the build prompt.
