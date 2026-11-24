/** Runs a real DFA on an input string and records every move. */
import type { Dfa } from './automata';
import { TraceRecorder, type Traced } from './types';

export interface AcceptResult {
  accepted: boolean;
  finalState: number;
  /** Why the run ended: consumed all input or got stuck. */
  reason: 'accepting-state' | 'non-accepting-state' | 'no-transition';
  stuckAt?: number;
}

export function runDfa(dfa: Dfa, input: string): Traced<AcceptResult> {
  const rec = new TraceRecorder();
  let state = dfa.start;
  rec.push('start', { state });
  const chars = [...input];
  for (let i = 0; i < chars.length; i++) {
    const symbol = chars[i] as string;
    const to = dfa.next(state, symbol);
    if (to === undefined) {
      rec.push('stuck', { index: i, symbol, from: state });
      rec.push('end', { state, accepted: false });
      return { result: { accepted: false, finalState: state, reason: 'no-transition', stuckAt: i }, steps: rec.steps };
    }
    rec.push('step', { index: i, symbol, from: state, to });
    state = to;
  }
  const accepted = Boolean(dfa.states.get(state)?.accepting);
  rec.push('end', { state, accepted });
  return { result: { accepted, finalState: state, reason: accepted ? 'accepting-state' : 'non-accepting-state' }, steps: rec.steps };
}
