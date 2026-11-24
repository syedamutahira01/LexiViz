/**
 * Thompson construction. Each fragment has exactly one start and one accept state.
 * symbol/epsilon: 2 states. concat: bridge A.accept -ε-> B.start.
 * union/star: new start and accept states joined with epsilon edges.
 * Only the final accept state of the whole NFA is marked accepting.
 */
import { EPSILON, IdGenerator, Nfa, type Transition } from './automata';
import type { AstNode } from './regex';
import { TraceRecorder, type StepEvent, type Traced } from './types';

interface Fragment {
  start: number;
  accept: number;
}

export function regexToNfa(ast: AstNode): Traced<Nfa> {
  const ids = new IdGenerator();
  const nfa = new Nfa();
  const rec = new TraceRecorder();

  /** Every fragment emits one event listing exactly the states and edges it added. */
  const emit = (node: AstNode, frag: Fragment, newStates: number[], edges: Transition[]): Fragment => {
    for (const s of newStates) nfa.addState(s);
    for (const e of edges) nfa.addTransition(e.from, e.to, e.symbol);
    rec.push('fragment', { astId: node.id, astType: node.type, start: frag.start, accept: frag.accept, newStates, edges });
    return frag;
  };
  const eps = (from: number, to: number): Transition => ({ from, to, symbol: EPSILON });

  function build(node: AstNode): Fragment {
    switch (node.type) {
      case 'symbol': {
        const s = ids.nextId(), f = ids.nextId();
        return emit(node, { start: s, accept: f }, [s, f], [{ from: s, to: f, symbol: node.value }]);
      }
      case 'epsilon': {
        const s = ids.nextId(), f = ids.nextId();
        return emit(node, { start: s, accept: f }, [s, f], [eps(s, f)]);
      }
      case 'concat': {
        const a = build(node.left);
        const b = build(node.right);
        return emit(node, { start: a.start, accept: b.accept }, [], [eps(a.accept, b.start)]);
      }
      case 'union': {
        const a = build(node.left);
        const b = build(node.right);
        const s = ids.nextId(), f = ids.nextId();
        return emit(node, { start: s, accept: f }, [s, f], [eps(s, a.start), eps(s, b.start), eps(a.accept, f), eps(b.accept, f)]);
      }
      case 'star': {
        const a = build(node.child);
        const s = ids.nextId(), f = ids.nextId();
        return emit(node, { start: s, accept: f }, [s, f], [eps(s, a.start), eps(s, f), eps(a.accept, a.start), eps(a.accept, f)]);
      }
    }
  }

  const root = build(ast);
  nfa.start = root.start;
  nfa.accepting.add(root.accept);
  rec.push('done', { start: root.start, accept: root.accept });
  return { result: nfa, steps: rec.steps };
}

/** Rebuild an NFA from the first `upto` trace steps (all steps when omitted). Used for replay tests and for the step-by-step graph. */
export function nfaFromTrace(steps: StepEvent[], upto = steps.length): Nfa {
  const nfa = new Nfa();
  for (const s of steps.slice(0, upto)) {
    if (s.kind === 'fragment') {
      for (const id of s.payload.newStates as number[]) nfa.addState(id);
      for (const e of s.payload.edges as Transition[]) nfa.addTransition(e.from, e.to, e.symbol);
    } else if (s.kind === 'done') {
      nfa.start = s.payload.start as number;
      nfa.accepting.add(s.payload.accept as number);
    }
  }
  return nfa;
}
