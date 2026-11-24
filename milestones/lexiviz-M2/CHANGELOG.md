# Changelog

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
