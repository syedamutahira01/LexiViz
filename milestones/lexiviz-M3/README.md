# LexiViz

A browser-based educational tool that visualizes Automata Theory and Compiler Construction. Every graph, tree and table is produced by the real algorithm, and the screen only reads the step trace the algorithm returns.

**Status: milestone M3 (core automata, lexer, symbol table, parser, 3D ring scene, pipeline navigator).** Music, narration and the algorithm-driven animations are later milestones (M4 and M5).

## Features (M1 to M3)
- Regex tokenizer and recursive-descent parser with a token table and a growing AST view
- Thompson construction (regex to NFA), stepped fragment by fragment
- Subset construction (NFA to DFA) showing ε-closure, move and the NFA states behind each DFA state
- DFA minimization by partition refinement, with the partition shown per round
- String acceptance with Play, Pause, Next, Previous, Reset and speed control
- Exact error positions for invalid regexes; empty input and unknown test symbols handled without crashing
- Lexer Lab: rule-based longest-match lexer with line and column numbers, candidate rules shown per lexeme, token table, symbol table, lexical errors with positions
- Parser Lab: recursive-descent parser for declarations, assignments and arithmetic; the parse tree grows in the order of the recursive calls; syntax errors show line, column and a caret

- 3D ring scene: about 40 tilted blocks in a ring (one InstancedMesh), spinning clockwise at 12 degrees per second, with a glowing sphere pinned at 2 o'clock. Block brightness follows the angular distance to the sphere. Three poses (hero arch, mid ring, compact ring) driven by one progress value and a critically damped spring; the pose follows the route.
- Compiler Pipeline Navigator on Home: six numbered boxes in the ring and a keyboard-accessible list. Selecting a phase pauses the ring, focuses the camera on its box and opens a panel (what, why, input, output, how). Lexical and Syntax Analysis link to their labs; the other four are labelled theory only.
- Fallbacks: static gradient when WebGL is unavailable, data saver is on, the 3D toggle is off, or the scene fails to start. Reduced motion stops the spin and the easing. Rendering pauses while the tab is hidden. Nothing depends on 3D.

## Stack
React, TypeScript (strict), Vite, react-router-dom, @xyflow/react (React Flow), lucide-react, three and @react-three/fiber. Dev: Vitest, Testing Library, happy-dom, oxlint, @types/three. No backend.

Justification for what was not added: `@react-three/drei` is on the allowed list but not needed (rounded boxes come from `three/examples`, the number labels are canvas textures). `@react-three/postprocessing` was skipped: the glow is two additive halo spheres plus a point light, which avoids a heavy extra pass on integrated GPUs.

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
src/scene/        rigMath.ts (pure: poses, spring, falloff, spin, route and capability decisions),
                  sceneStore.ts, sceneSettings.ts, SceneLayer.tsx (decides 3D or static),
                  SceneCanvas.tsx (the only file that imports three; loaded lazily)
src/data/         phases.ts: navigator content as plain data
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
`npm run test` runs 152 tests (the 3D drawing code is verified in a real browser; its math and decisions are unit tested). The parse trees are checked by evaluating them and comparing with JavaScript's own arithmetic (precedence, associativity, parentheses). The automaton tests compare every string up to length 6 against JavaScript's own `RegExp` as an independent oracle, for both the DFA and the minimized DFA. The UI tests stub the graph component (happy-dom cannot lay out React Flow); graph rendering was checked in a real browser with Playwright.

## 3D scene notes (viva)
- **One progress value:** p = 0 is the hero arch A (scale 3.0, pitched back 58 degrees, centre below the viewport), 0.5 is the mid ring B (scale 0.8, pitch 15), 1 is the compact ring C (scale 0.65, pitch 0, upper middle). Scale is interpolated geometrically, the rest linearly.
- **Damped spring:** critically damped smoothing (SmoothDamp). About 3 percent of the distance is left after 0.5 s and 0.1 percent after 0.8 s, with no overshoot. While progress is changing, the spin speeds up (capped at 3.5 times).
- **Brightness:** `floor + (1 - floor) * exp(-(d / sigma)^2)` where d is the shortest angle between a block and the sphere.
- **Route mapping:** Home hero = A, Home scrolled to the navigator = B, every other page = C.
- **Performance (not measured on a real GPU):** the render loop pauses when the tab is hidden, the pixel ratio is capped at 1.5, and the 3D code is a separate chunk (about 245 kB gzip) loaded only when the scene is used. Headless software rendering in the build container reached only about 13 fps, which says nothing about a real GPU. The 60 and 30 fps targets are not verified; please check them on your laptop.
- **Known console warning:** react-three-fiber 9.8.2 logs a `THREE.Clock` deprecation warning from inside the library with three 0.187. It is harmless and not from this code.

## Assumptions
- The empty pattern means ε in the algorithms; the Automata Lab asks the user to type something and suggests `ε`.
- Whitespace in a regex is rejected rather than ignored, so error positions stay exact.
- The DFA is partial (no dead state drawn).

## Known limitations
- Music, narration and the algorithm-driven animations are not built yet (M4 and M5).
- The 3D scene is decorative in M3: the sphere does not yet follow algorithm steps (M5).
- The 3D boxes are clickable only on Home once the navigator is in view; clicks on page controls never select a box behind them.
- The lexer has no comments, strings or decimals. The parser has no if/while, functions or comparison operators in expressions, and stops at the first error.
- Parsing is blocked while the lexer reports invalid characters.
- On some DFAs a long edge label can sit close to another label; the layout is a simple layered one.
- UI tests do not exercise React Flow itself.

## Future improvements
Milestones M4 to M6 of the build prompt.
