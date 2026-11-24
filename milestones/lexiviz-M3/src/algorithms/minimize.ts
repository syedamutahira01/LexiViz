/**
 * DFA minimization by partition refinement (Moore):
 * 1. remove unreachable states  2. split into accepting / non-accepting
 * 3. refine until stable: states stay together only if, for every symbol, they move into the same group
 * 4. merge each group into one state.
 * A missing transition behaves as an implicit dead state (group -1).
 */
import { Dfa } from './automata';
import { TraceRecorder, type Traced } from './types';

export interface MinimizeResult {
  dfa: Dfa;
  /** Final partition: each group lists the original DFA state ids that were merged. */
  groups: number[][];
  removedUnreachable: number[];
}

export function minimizeDfa(input: Dfa): Traced<MinimizeResult> {
  const rec = new TraceRecorder();
  const alphabet = input.alphabet();

  // 1. reachability
  const reachable = new Set<number>([input.start]);
  const stack = [input.start];
  while (stack.length) {
    const s = stack.pop() as number;
    for (const a of alphabet) {
      const t = input.next(s, a);
      if (t !== undefined && !reachable.has(t)) { reachable.add(t); stack.push(t); }
    }
  }
  const removedUnreachable = [...input.states.keys()].filter((id) => !reachable.has(id)).sort((a, b) => a - b);
  rec.push('removeUnreachable', { removed: removedUnreachable });

  // 2. initial partition
  const live = [...reachable].sort((a, b) => a - b);
  const acc = live.filter((id) => input.states.get(id)?.accepting);
  const non = live.filter((id) => !input.states.get(id)?.accepting);
  let groups: number[][] = [non, acc].filter((g) => g.length > 0);
  rec.push('initialPartition', { groups: groups.map((g) => [...g]) });

  // 3. refine
  let round = 0;
  for (;;) {
    const groupOf = new Map<number, number>();
    groups.forEach((g, i) => g.forEach((s) => groupOf.set(s, i)));
    const next: number[][] = [];
    for (const g of groups) {
      const buckets = new Map<string, number[]>();
      for (const s of g) {
        const sig = alphabet.map((a) => {
          const t = input.next(s, a);
          return t === undefined ? -1 : (groupOf.get(t) as number);
        }).join(',');
        const b = buckets.get(sig);
        if (b) b.push(s); else buckets.set(sig, [s]);
      }
      next.push(...buckets.values());
    }
    next.sort((a, b) => (a[0] as number) - (b[0] as number));
    round++;
    const changed = next.length !== groups.length;
    rec.push('refine', { round, groups: next.map((g) => [...g]), changed });
    groups = next;
    if (!changed) break;
  }

  // 4. merge
  const startGroup = groups.findIndex((g) => g.includes(input.start));
  // keep the start group as M0 for readability
  const order = [startGroup, ...groups.map((_, i) => i).filter((i) => i !== startGroup)];
  const ordered = order.map((i) => groups[i] as number[]);
  const out = new Dfa();
  const newId = new Map<number, number>();
  ordered.forEach((g, i) => {
    g.forEach((s) => newId.set(s, i));
    out.addState({ id: i, label: `M${i}`, accepting: Boolean(input.states.get(g[0] as number)?.accepting), members: [...g] });
  });
  out.start = 0;
  ordered.forEach((g, i) => {
    for (const a of alphabet) {
      const t = input.next(g[0] as number, a);
      if (t !== undefined) out.addTransition(i, a, newId.get(t) as number);
    }
  });
  rec.push('merge', { groups: ordered.map((g) => [...g]), stateCount: out.states.size });
  return { result: { dfa: out, groups: ordered, removedUnreachable }, steps: rec.steps };
}
