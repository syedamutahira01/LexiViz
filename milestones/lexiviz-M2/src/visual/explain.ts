/** Turns real trace events into plain-language explanations. Reads traces only; never recomputes algorithm results. */
import type { StepEvent } from '../algorithms';

const set = (xs: unknown) => `{${(xs as number[]).join(', ')}}`;

export function explainParse(s: StepEvent): string {
  const p = s.payload;
  switch (s.kind) {
    case 'token': return `Tokenizer read '${p.value}' at position ${(p.position as number) + 1} as ${p.type}.`;
    case 'node': {
      const kids = p.children as number[] | undefined;
      if (p.type === 'symbol') return `Parser created leaf node #${p.id}: symbol '${p.value}'.`;
      if (p.type === 'epsilon') return `Parser created leaf node #${p.id}: epsilon (the empty string).`;
      return `Parser created ${p.type} node #${p.id} from ${kids?.map((k) => `#${k}`).join(' and ')}.`;
    }
    default: return `Parsing finished. The root of the AST is node #${p.root}.`;
  }
}

export function explainNfa(s: StepEvent): string {
  const p = s.payload;
  if (s.kind === 'done') return `Construction finished. Start state q${p.start}, the only accepting state is q${p.accept}.`;
  const t = p.astType as string;
  const head = `Fragment for AST node #${p.astId} (${t}): start q${p.start}, accept q${p.accept}.`;
  const why: Record<string, string> = {
    symbol: 'Two new states joined by one edge labelled with the symbol.',
    epsilon: 'Two new states joined by an ε edge.',
    concat: 'The accept state of the left fragment is bridged to the start of the right fragment with an ε edge.',
    union: 'A new start state branches by ε into both fragments, and both accept states join a new accept state by ε.',
    star: 'A new start and accept state are added; ε edges allow skipping the fragment or repeating it.',
  };
  return `${head} ${why[t] ?? ''}`;
}

export function explainDfa(s: StepEvent): string {
  const p = s.payload;
  switch (s.kind) {
    case 'startClosure': return `ε-closure of the NFA start state q${p.from} is ${set(p.closure)}.`;
    case 'newState': return `New DFA state ${p.label} represents NFA states ${set(p.members)}${p.accepting ? ' and is accepting (it contains the NFA accept state)' : ''}.`;
    case 'move': return `From D${p.from} on '${p.symbol}': move gives ${set(p.moved)}, ε-closure gives ${set(p.closure)}, which is ${p.isNew ? 'a newly discovered state' : 'an existing state'} D${p.to}.`;
    case 'noTransition': return `From D${p.from} on '${p.symbol}': no NFA state can move, so there is no transition (implicit dead state).`;
    default: return `Subset construction finished with ${p.stateCount} DFA states.`;
  }
}

const groupsText = (gs: unknown) => (gs as number[][]).map((g) => `{${g.map((x) => `D${x}`).join(', ')}}`).join('  ');

export function explainMin(s: StepEvent): string {
  const p = s.payload;
  switch (s.kind) {
    case 'removeUnreachable': return (p.removed as number[]).length ? `Removed unreachable states: ${(p.removed as number[]).map((x) => `D${x}`).join(', ')}.` : 'No unreachable states to remove.';
    case 'initialPartition': return `Initial partition (non-accepting vs accepting): ${groupsText(p.groups)}.`;
    case 'refine': return `Refinement round ${p.round}: ${groupsText(p.groups)}. ${p.changed ? 'Some group was split, so refine again.' : 'Nothing changed, so the partition is stable.'}`;
    default: return `Each group became one state, giving ${p.stateCount} states.`;
  }
}

export function explainRun(s: StepEvent, label: (id: number) => string): string {
  const p = s.payload;
  switch (s.kind) {
    case 'start': return `Start in state ${label(p.state as number)}.`;
    case 'step': return `Read '${p.symbol}' (position ${(p.index as number) + 1}): ${label(p.from as number)} → ${label(p.to as number)}.`;
    case 'stuck': return `Read '${p.symbol}' (position ${(p.index as number) + 1}): state ${label(p.from as number)} has no transition on it, so the string is rejected.`;
    default: return p.accepted ? `Input consumed in accepting state ${label(p.state as number)}: ACCEPTED.` : `Stopped in state ${label(p.state as number)}: REJECTED.`;
  }
}

export function explainLex(s: StepEvent): string {
  const p = s.payload;
  if (s.kind === 'error') return `Unexpected character '${p.char}' at line ${p.line}, column ${p.column}. The lexer reports it and skips it, then keeps scanning.`;
  const cands = p.candidates as { rule: string; length: number }[];
  const head = `At line ${p.line}, column ${p.column} the lexer matched '${p.lexeme}' as ${p.type}.`;
  if (cands.length <= 1) return `${head} Only the ${p.rule} rule matched here.`;
  const list = cands.map((c) => `${c.rule} (${c.length})`).join(', ');
  const top = Math.max(...cands.map((c) => c.length));
  const tied = cands.filter((c) => c.length === top).length > 1;
  return `${head} Candidate rules: ${list}. ${tied ? `Equal length, so the rule listed first wins: ${p.rule}.` : `The longest match wins: ${p.rule}.`}`;
}

export function explainParseRule(s: StepEvent): string {
  const p = s.payload;
  switch (s.kind) {
    case 'enter': return `Enter rule ${p.rule}. Next token: ${p.lookahead === null ? 'end of input' : `'${p.lookahead}'`}.`;
    case 'match': return `Matched ${p.type} '${p.lexeme}' (line ${p.line}, column ${p.column}) and moved to the next token.`;
    case 'exit': return `Finished rule ${p.rule}. Control returns to the rule that called it.`;
    case 'error': return `Syntax error at line ${p.line}, column ${p.column}: ${p.message}.`;
    default: return p.ok ? 'The whole token stream was consumed: the program is valid.' : 'Parsing stopped at the first syntax error.';
  }
}
