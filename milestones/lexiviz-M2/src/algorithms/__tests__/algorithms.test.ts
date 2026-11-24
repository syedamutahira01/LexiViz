import { describe, expect, it } from 'vitest';
import {
  Dfa, DeterminismError, EPSILON, RegexSyntaxError, astToString, buildPipeline, dfaFromTrace, epsilonClosure,
  minimizeDfa, nfaFromTrace, nfaToDfa, parseRegex, regexToNfa, replayParseTrace, runDfa, tokenize,
} from '..';

/** Every string over `alphabet` up to `maxLen`, used to compare against JavaScript's own RegExp as an oracle. */
function allStrings(alphabet: string[], maxLen: number): string[] {
  const out = [''];
  let layer = [''];
  for (let i = 0; i < maxLen; i++) {
    layer = layer.flatMap((s) => alphabet.map((a) => s + a));
    out.push(...layer);
  }
  return out;
}
const accepts = (p: ReturnType<typeof buildPipeline>, s: string, which: 'dfa' | 'min' = 'min') =>
  runDfa(which === 'dfa' ? p.dfa.result : p.min.result.dfa, s).result.accepted;

describe('regex tokenizer and parser', () => {
  it('tokenizes with positions', () => {
    expect(tokenize('a|b*').map((t) => [t.type, t.position])).toEqual([['symbol', 0], ['union', 1], ['symbol', 2], ['star', 3]]);
  });
  it('respects precedence: star > concat > alternation', () => {
    expect(astToString(parseRegex('ab*|c').result)).toBe('((a(b)*)|c)');
    expect(astToString(parseRegex('a|bc').result)).toBe('(a|(bc))');
    expect(astToString(parseRegex('(a|b)*').result)).toBe('((a|b))*');
  });
  it('treats empty pattern, () and ε as epsilon', () => {
    expect(parseRegex('').result.type).toBe('epsilon');
    expect(parseRegex('()').result.type).toBe('epsilon');
    expect(parseRegex('ε').result.type).toBe('epsilon');
  });
  it.each([
    ['(a', 'missing closing parenthesis', 0],
    ['a)', 'unmatched closing parenthesis', 1],
    ['*a', 'nothing to repeat', 0],
    ['a|', "missing expression after '|'", 2],
    ['a||b', "missing expression after '|'", 2],
    ['a b', 'whitespace', 1],
    ['a+', 'not supported', 1],
    ['(*)', 'nothing to repeat', 1],
  ])('rejects %j with a position', (input, text, position) => {
    try {
      parseRegex(input);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(RegexSyntaxError);
      expect((e as RegexSyntaxError).message).toContain('Invalid regular expression');
      expect((e as RegexSyntaxError).message).toContain(text);
      expect((e as RegexSyntaxError).position).toBe(position);
    }
  });
  it('trace replay reproduces the AST', () => {
    for (const p of ['a', 'ab|c*', '(a|b)*abb', 'a(b|())*']) {
      const t = parseRegex(p);
      expect(replayParseTrace(t.steps)).toEqual(t.result);
    }
  });
});

describe('Thompson construction', () => {
  const patterns = ['a', 'ab', 'a|b', 'a*', '(a|b)*', '(a|b)*abb', 'a(b|c)*d', 'ε', '()', '((a*)*)', 'a*b*|c'];
  it.each(patterns)('keeps structural invariants for %s', (p) => {
    const { result: nfa } = regexToNfa(parseRegex(p).result);
    expect(nfa.accepting.size).toBe(1);
    expect(nfa.incoming(nfa.start)).toHaveLength(0);
    const [accept] = [...nfa.accepting] as [number];
    expect(nfa.outgoing(accept)).toHaveLength(0);
    expect(new Set(nfa.states).size).toBe(nfa.states.size);
  });
  it('builds the textbook NFA for a|b (6 states, 6 transitions)', () => {
    const { result } = regexToNfa(parseRegex('a|b').result);
    expect(result.states.size).toBe(6);
    expect(result.transitions).toHaveLength(6);
    expect(result.transitions.filter((t) => t.symbol === EPSILON)).toHaveLength(4);
  });
  it('trace replay reproduces the NFA', () => {
    const t = regexToNfa(parseRegex('(a|b)*abb').result);
    const replay = nfaFromTrace(t.steps);
    expect(replay.states).toEqual(t.result.states);
    expect(replay.transitions).toEqual(t.result.transitions);
    expect(replay.start).toBe(t.result.start);
    expect(replay.accepting).toEqual(t.result.accepting);
  });
  it('epsilon closure follows epsilon edges only', () => {
    const { result: nfa } = regexToNfa(parseRegex('a*').result);
    const closure = epsilonClosure(nfa, [nfa.start]);
    expect(closure).toContain([...nfa.accepting][0]);
    expect(closure.length).toBeGreaterThan(2);
  });
});

describe('DFA data structure', () => {
  it('rejects nondeterminism and epsilon transitions', () => {
    const d = new Dfa();
    d.addState({ id: 0, label: 'D0', accepting: false, members: [] });
    d.addState({ id: 1, label: 'D1', accepting: true, members: [] });
    d.addTransition(0, 'a', 1);
    expect(() => d.addTransition(0, 'a', 0)).toThrow(DeterminismError);
    expect(() => d.addTransition(0, EPSILON, 1)).toThrow(DeterminismError);
  });
});

describe('subset construction + minimization + acceptance agree with JavaScript RegExp', () => {
  const cases: [string, string[]][] = [
    ['a', ['a', 'b']],
    ['a|b', ['a', 'b']],
    ['ab', ['a', 'b']],
    ['a*', ['a', 'b']],
    ['(a|b)*', ['a', 'b']],
    ['(a|b)*abb', ['a', 'b']],
    ['a(b|c)*d', ['a', 'b', 'c', 'd']],
    ['(ab|a)*', ['a', 'b']],
    ['a*b*', ['a', 'b']],
    ['((a*)*)b', ['a', 'b']],
    ['(a|ε)b', ['a', 'b']],
  ];
  it.each(cases)('%s', (pattern, alphabet) => {
    const p = buildPipeline(pattern);
    const oracle = new RegExp(`^(?:${pattern.replace(/ε/g, '')})$`);
    for (const s of allStrings(alphabet, 6)) {
      expect(accepts(p, s, 'dfa'), `DFA on "${s}"`).toBe(oracle.test(s));
      expect(accepts(p, s, 'min'), `minimized DFA on "${s}"`).toBe(oracle.test(s));
    }
  });
  it('epsilon pattern accepts only the empty string', () => {
    const p = buildPipeline('ε');
    expect(accepts(p, '')).toBe(true);
    expect(accepts(p, 'a')).toBe(false);
  });
  it('(a|b)*abb minimizes to the textbook 4 states', () => {
    const p = buildPipeline('(a|b)*abb');
    expect(p.dfa.result.states.size).toBe(5);
    expect(p.min.result.dfa.states.size).toBe(4);
  });
  it('subset construction records which NFA states each DFA state represents', () => {
    const p = buildPipeline('(a|b)*abb');
    const start = p.dfa.result.states.get(p.dfa.result.start);
    expect(start?.members).toEqual(epsilonClosure(p.nfa.result, [p.nfa.result.start]));
    for (const s of p.dfa.result.states.values()) expect(s.members.length).toBeGreaterThan(0);
  });
  it('subset trace replay reproduces the DFA', () => {
    const t = nfaToDfa(regexToNfa(parseRegex('(a|b)*abb').result).result);
    const replay = dfaFromTrace(t.steps);
    expect([...replay.states.values()]).toEqual([...t.result.states.values()]);
    expect(replay.transitions).toEqual(t.result.transitions);
    expect(replay.start).toBe(t.result.start);
  });
  it('minimization removes unreachable states and merges equivalent ones', () => {
    // hand-built DFA: 0 -a-> 1, 0 -b-> 2, 1 and 2 are equivalent (both accepting, loop to themselves); 3 is unreachable
    const d = new Dfa();
    for (const [id, acc] of [[0, false], [1, true], [2, true], [3, false]] as const) d.addState({ id, label: `D${id}`, accepting: acc, members: [] });
    d.start = 0;
    d.addTransition(0, 'a', 1); d.addTransition(0, 'b', 2);
    d.addTransition(1, 'a', 1); d.addTransition(2, 'a', 2);
    d.addTransition(3, 'a', 0);
    const { result, steps } = minimizeDfa(d);
    expect(result.removedUnreachable).toEqual([3]);
    expect(result.dfa.states.size).toBe(2);
    expect(result.groups).toEqual([[0], [1, 2]]);
    expect(runDfa(result.dfa, 'ba').result.accepted).toBe(true);
    // trace replay: last merge event reproduces the groups
    const merge = steps.filter((s) => s.kind === 'merge').at(-1);
    expect(merge?.payload.groups).toEqual(result.groups);
    // the refinement stops only when a round changes nothing
    const refines = steps.filter((s) => s.kind === 'refine');
    expect(refines.at(-1)?.payload.changed).toBe(false);
  });
  it('minimized DFA has no more states than the DFA, and is language-equivalent', () => {
    for (const pattern of ['(a|b)*', 'a*b*', '(ab|a)*', 'a(b|c)*d']) {
      const p = buildPipeline(pattern);
      expect(p.min.result.dfa.states.size).toBeLessThanOrEqual(p.dfa.result.states.size);
    }
  });
});

describe('string acceptance', () => {
  it('reports every move and the final verdict', () => {
    const p = buildPipeline('ab*');
    const ok = runDfa(p.min.result.dfa, 'abb');
    expect(ok.result.accepted).toBe(true);
    expect(ok.steps.map((s) => s.kind)).toEqual(['start', 'step', 'step', 'step', 'end']);
    const bad = runDfa(p.min.result.dfa, 'ba');
    expect(bad.result).toMatchObject({ accepted: false, reason: 'no-transition', stuckAt: 0 });
    expect(runDfa(p.min.result.dfa, '').result.accepted).toBe(false);
    expect(runDfa(p.min.result.dfa, 'xyz').result.accepted).toBe(false);
  });
  it('replaying the trace ends in the reported state', () => {
    const p = buildPipeline('(a|b)*abb');
    const run = runDfa(p.dfa.result, 'abababb');
    let state = run.steps[0]?.payload.state as number;
    for (const s of run.steps) if (s.kind === 'step') { expect(s.payload.from).toBe(state); state = s.payload.to as number; }
    expect(state).toBe(run.result.finalState);
  });
});
