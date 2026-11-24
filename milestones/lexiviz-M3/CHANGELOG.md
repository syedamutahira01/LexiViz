# Changelog

## M3 - 3D foundation and navigator
- Ring scene: instanced blocks, pinned glowing sphere, starfield, floor grid; three poses driven by one progress value and a damped spring; clockwise spin with a progress-velocity boost
- Route-driven states: Home hero = A, Home scrolled = B, other pages = C
- Pure rig math with unit tests; mutation-checked
- Compiler Pipeline Navigator: keyboard list plus clickable 3D boxes, camera focus, detail panel, lab links for implemented phases
- Reduced-motion path, WebGL/data-saver/user-off/error fallback to a static backdrop, hidden-tab pause, lazy-loaded 3D chunk, sidebar 3D toggle saved in localStorage
- Dependencies added: three, @react-three/fiber, @types/three

## M2 - lexer and parser
- Lexer with longest-match rules, tie-breaking, line and column tracking, error recovery and trace
- Symbol table (name, token, type, value, line) built from tokens, with trace
- Recursive-descent parser for declarations, assignments and arithmetic, with parse tree, error positions and trace
- Lexer Lab and Parser Lab pages
- Tests grew from 58 to 112, including parse-tree evaluation against JavaScript arithmetic

## M1 - core automata
- Project setup: Vite, React, strict TypeScript, oxlint, Vitest
- App shell with sidebar and routing; placeholder pages for the Lexer Lab and Parser Lab
- Regex tokenizer and recursive-descent parser with trace and RegexSyntaxError positions
- Thompson construction, subset construction, DFA minimization and string acceptance, all with traces
- Automata Lab: tokens table, AST view, NFA/DFA/minimized DFA graphs, step controls, test-string runner
- 58 tests including a RegExp oracle comparison and trace replay checks
