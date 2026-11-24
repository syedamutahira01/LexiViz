/** Content for the Compiler Pipeline Navigator. Plain data, so a new phase or language needs no code changes. */
export type PhaseId = 'lexical' | 'syntax' | 'semantic' | 'intermediate' | 'optimization' | 'codegen';

export interface Phase {
  id: PhaseId;
  name: string;
  what: string;
  why: string;
  input: string;
  output: string;
  how: string;
  /** Route of the lab that implements this phase, or null when LexiViz explains it as theory only. */
  lab: string | null;
}

export const PHASES: readonly Phase[] = [
  { id: 'lexical', name: 'Lexical Analysis', lab: '/lexer',
    what: 'Reads the source text character by character and groups characters into tokens such as keywords, identifiers, numbers and operators.',
    why: 'Later phases should work with meaningful units, not raw characters. The lexer also throws away whitespace and reports illegal characters.',
    input: 'Source code as a stream of characters.',
    output: 'A stream of tokens with line and column numbers, and names collected for the symbol table.',
    how: 'Pattern rules (regular expressions, which are recognised by finite automata) are tried at each position and the longest match wins.' },
  { id: 'syntax', name: 'Syntax Analysis', lab: '/parser',
    what: 'Checks that the tokens follow the grammar of the language and arranges them into a tree that shows the program structure.',
    why: 'Structure decides meaning: in 1 + 2 * 3 the multiplication must be grouped first. Grammar errors are reported here.',
    input: 'The token stream from the lexer.',
    output: 'A parse tree or abstract syntax tree, or a syntax error with its position.',
    how: 'Top-down parsers such as recursive descent have one function per grammar rule. Bottom-up (LR) parsers use a table-driven stack machine.' },
  { id: 'semantic', name: 'Semantic Analysis', lab: null,
    what: 'Checks the meaning of a syntactically correct program: types, declarations before use, scope rules.',
    why: 'A program can follow the grammar and still make no sense, for example adding a number to a function or using an undeclared variable.',
    input: 'The syntax tree and the symbol table.',
    output: 'A tree annotated with types and resolved names, plus semantic errors.',
    how: 'The tree is walked, names are looked up in the symbol table, and each operation is checked against the type rules.' },
  { id: 'intermediate', name: 'Intermediate Code', lab: null,
    what: 'Translates the checked tree into a simple machine-independent form, often three-address code.',
    why: 'One intermediate form lets many source languages and many target machines share the same optimiser.',
    input: 'The annotated syntax tree.',
    output: 'Intermediate code, for example t1 = 2 * 3 followed by t2 = 1 + t1.',
    how: 'The tree is traversed and each operator becomes one instruction that stores its result in a new temporary variable.' },
  { id: 'optimization', name: 'Optimization', lab: null,
    what: 'Rewrites the intermediate code so that it runs faster or uses less memory without changing what the program does.',
    why: 'Straightforward translation often leaves redundant work that can be removed safely.',
    input: 'Intermediate code.',
    output: 'Equivalent but improved intermediate code.',
    how: 'Typical techniques are constant folding, dead-code elimination, common-subexpression elimination and loop optimisations.' },
  { id: 'codegen', name: 'Code Generation', lab: null,
    what: 'Produces code for the target machine, such as assembly or machine instructions.',
    why: 'This is the step that turns the program into something a processor can run.',
    input: 'Optimised intermediate code.',
    output: 'Target machine code or assembly.',
    how: 'Instruction selection chooses machine instructions, register allocation decides which values live in registers, and instructions are ordered for the target.' },
];
