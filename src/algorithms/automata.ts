/** Automata data structures. Pure TypeScript: no React, no three. */
export const EPSILON = 'ε';

export interface Transition {
  from: number;
  to: number;
  symbol: string; // EPSILON for epsilon edges
}

/** Shared generator so state ids are unique across all fragments of one construction. */
export class IdGenerator {
  private next = 0;
  nextId(): number {
    return this.next++;
  }
}

export class Nfa {
  readonly states = new Set<number>();
  readonly transitions: Transition[] = [];
  start = -1;
  readonly accepting = new Set<number>();

  addState(id: number): void {
    this.states.add(id);
  }
  addTransition(from: number, to: number, symbol: string): void {
    if (!this.states.has(from) || !this.states.has(to)) {
      throw new Error(`Transition ${from} -${symbol}-> ${to} uses an unknown state`);
    }
    this.transitions.push({ from, to, symbol });
  }
  alphabet(): string[] {
    const set = new Set<string>();
    for (const t of this.transitions) if (t.symbol !== EPSILON) set.add(t.symbol);
    return [...set].sort();
  }
  outgoing(state: number): Transition[] {
    return this.transitions.filter((t) => t.from === state);
  }
  incoming(state: number): Transition[] {
    return this.transitions.filter((t) => t.to === state);
  }
}

export class DeterminismError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeterminismError';
  }
}

export interface DfaState {
  id: number;
  label: string;
  accepting: boolean;
  /** NFA states (subset construction) or DFA states (minimization) this state stands for. */
  members: number[];
}

export class Dfa {
  readonly states = new Map<number, DfaState>();
  private readonly delta = new Map<number, Map<string, number>>();
  start = -1;

  addState(state: DfaState): void {
    if (this.states.has(state.id)) throw new Error(`Duplicate DFA state ${state.id}`);
    this.states.set(state.id, state);
    this.delta.set(state.id, new Map());
  }
  /** Enforces determinism: one target per (state, symbol), and no epsilon edges. */
  addTransition(from: number, symbol: string, to: number): void {
    if (symbol === EPSILON || symbol === '') {
      throw new DeterminismError('A DFA cannot have epsilon transitions');
    }
    const row = this.delta.get(from);
    if (!row || !this.states.has(to)) throw new Error(`Unknown state in ${from} -${symbol}-> ${to}`);
    if (row.has(symbol)) {
      throw new DeterminismError(`State ${from} already has a transition on '${symbol}'`);
    }
    row.set(symbol, to);
  }
  next(from: number, symbol: string): number | undefined {
    return this.delta.get(from)?.get(symbol);
  }
  get transitions(): Transition[] {
    const out: Transition[] = [];
    for (const [from, row] of this.delta) for (const [symbol, to] of row) out.push({ from, to, symbol });
    return out;
  }
  alphabet(): string[] {
    return [...new Set(this.transitions.map((t) => t.symbol))].sort();
  }
  get acceptingIds(): number[] {
    return [...this.states.values()].filter((s) => s.accepting).map((s) => s.id);
  }
}
