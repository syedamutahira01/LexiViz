/** Subset construction (NFA -> DFA) with epsilon-closure and move. Missing transitions mean an implicit dead state (rejection). */
import { Dfa, EPSILON, type Nfa } from './automata';
import { TraceRecorder, type StepEvent, type Traced } from './types';

export function epsilonClosure(nfa: Nfa, states: Iterable<number>): number[] {
  const seen = new Set<number>(states);
  const stack = [...seen];
  while (stack.length) {
    const s = stack.pop() as number;
    for (const t of nfa.outgoing(s)) {
      if (t.symbol === EPSILON && !seen.has(t.to)) {
        seen.add(t.to);
        stack.push(t.to);
      }
    }
  }
  return [...seen].sort((a, b) => a - b);
}

export function move(nfa: Nfa, states: Iterable<number>, symbol: string): number[] {
  const out = new Set<number>();
  for (const s of states) for (const t of nfa.outgoing(s)) if (t.symbol === symbol) out.add(t.to);
  return [...out].sort((a, b) => a - b);
}

export function nfaToDfa(nfa: Nfa): Traced<Dfa> {
  const dfa = new Dfa();
  const rec = new TraceRecorder();
  const alphabet = nfa.alphabet();
  const keyOf = (set: number[]) => set.join(',');
  const idByKey = new Map<string, number>();
  const queue: number[] = [];

  const addDfaState = (members: number[]): number => {
    const id = idByKey.size;
    const accepting = members.some((m) => nfa.accepting.has(m));
    idByKey.set(keyOf(members), id);
    dfa.addState({ id, label: `D${id}`, accepting, members });
    rec.push('newState', { id, label: `D${id}`, members, accepting });
    queue.push(id);
    return id;
  };

  const startClosure = epsilonClosure(nfa, [nfa.start]);
  rec.push('startClosure', { from: nfa.start, closure: startClosure });
  dfa.start = addDfaState(startClosure);

  while (queue.length) {
    const current = queue.shift() as number;
    const members = (dfa.states.get(current) as { members: number[] }).members;
    for (const symbol of alphabet) {
      const moved = move(nfa, members, symbol);
      if (moved.length === 0) {
        rec.push('noTransition', { from: current, symbol, moved });
        continue;
      }
      const closure = epsilonClosure(nfa, moved);
      let target = idByKey.get(keyOf(closure));
      const isNew = target === undefined;
      if (target === undefined) target = addDfaState(closure);
      dfa.addTransition(current, symbol, target);
      rec.push('move', { from: current, symbol, moved, closure, to: target, isNew });
    }
  }
  rec.push('done', { stateCount: dfa.states.size });
  return { result: dfa, steps: rec.steps };
}

/** Rebuild a DFA from the first `upto` steps of a subset-construction trace. */
export function dfaFromTrace(steps: StepEvent[], upto = steps.length): Dfa {
  const dfa = new Dfa();
  let first = true;
  for (const s of steps.slice(0, upto)) {
    if (s.kind === 'newState') {
      const p = s.payload as { id: number; label: string; members: number[]; accepting: boolean };
      dfa.addState({ id: p.id, label: p.label, members: p.members, accepting: p.accepting });
      if (first) { dfa.start = p.id; first = false; }
    } else if (s.kind === 'move') {
      const p = s.payload as { from: number; symbol: string; to: number };
      dfa.addTransition(p.from, p.symbol, p.to);
    }
  }
  return dfa;
}
