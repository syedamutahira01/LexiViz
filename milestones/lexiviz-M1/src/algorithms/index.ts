import { nfaToDfa } from './subset';
import { minimizeDfa } from './minimize';
import { parseRegex } from './regex';
import { regexToNfa } from './thompson';

export * from './types';
export * from './automata';
export * from './regex';
export * from './thompson';
export * from './subset';
export * from './minimize';
export * from './accept';

/** Runs the whole Automata Lab chain on one pattern. Throws RegexSyntaxError on invalid input. */
export function buildPipeline(pattern: string) {
  const parse = parseRegex(pattern);
  const nfa = regexToNfa(parse.result);
  const dfa = nfaToDfa(nfa.result);
  const min = minimizeDfa(dfa.result);
  return { pattern, parse, nfa, dfa, min };
}
export type Pipeline = ReturnType<typeof buildPipeline>;
