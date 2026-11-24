import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  RegexSyntaxError, buildPipeline, dfaFromTrace, nfaFromTrace, runDfa, type Dfa, type Nfa, type Pipeline, type StepEvent,
} from '../algorithms';
import { Graph, type GraphProps } from '../components/Graph';
import { StepControls, usePlayer } from '../components/Stepper';
import { explainDfa, explainMin, explainNfa, explainParse, explainRun } from '../visual/explain';
import { forestFromTrace, type TreeNode } from '../visual/forest';

const EXAMPLES = ['a', 'a|b', 'ab', 'a*', '(a|b)*'];
type View = 'parse' | 'nfa' | 'dfa' | 'min' | 'run';
const TABS: { id: View; label: string }[] = [
  { id: 'parse', label: 'Tokens & AST' }, { id: 'nfa', label: 'NFA' }, { id: 'dfa', label: 'DFA' }, { id: 'min', label: 'Minimized DFA' }, { id: 'run', label: 'Test string' },
];

const ABOUT: Record<View, { what: string; why: string; input: string; algorithm: string; shows: string }> = {
  parse: { what: 'The regex is split into tokens and parsed into a tree.', why: 'Every later step needs the structure of the pattern, not just its characters.', input: 'The regex text.', algorithm: 'Tokenizer + recursive descent (Alternation, Concatenation, Star, Atom).', shows: 'Tokens appear one by one; the AST grows node by node.' },
  nfa: { what: 'The AST becomes a nondeterministic finite automaton.', why: 'An NFA is easy to build mechanically from each operator.', input: 'The AST.', algorithm: "Thompson's construction.", shows: 'One fragment per AST node. Dashed edges are ε edges.' },
  dfa: { what: 'The NFA becomes a deterministic automaton.', why: 'A DFA has one move per symbol, so it runs in a single pass over the input.', input: 'The NFA.', algorithm: 'Subset construction with ε-closure and move.', shows: 'Each DFA state is a set of NFA states. New states appear as they are discovered.' },
  min: { what: 'Equivalent DFA states are merged.', why: 'A smaller automaton accepts the same language with fewer states.', input: 'The DFA.', algorithm: 'Partition refinement (accepting vs non-accepting, split until stable).', shows: 'The partition after each round and the merged automaton.' },
  run: { what: 'A test string is run through the automaton.', why: 'Running it proves the automaton recognises the language.', input: 'A string and the DFA.', algorithm: 'One transition per character, then check the final state.', shows: 'The current state and the transition taken. Amber marks the current position.' },
};

function nfaGraph(nfa: Nfa): Pick<GraphProps, 'states' | 'edges' | 'start'> {
  return { states: [...nfa.states].sort((a, b) => a - b).map((id) => ({ id, label: `q${id}`, accepting: nfa.accepting.has(id) })), edges: nfa.transitions, start: nfa.start };
}
function dfaGraph(dfa: Dfa): Pick<GraphProps, 'states' | 'edges' | 'start'> {
  return { states: [...dfa.states.values()].map((s) => ({ id: s.id, label: s.label, accepting: s.accepting })), edges: dfa.transitions, start: dfa.start };
}

function Info({ rows }: { rows: [string, string][] }) {
  return <dl className="info mono">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}
function Explain({ text }: { text: string }) {
  return <p className="explain" aria-live="polite">{text}</p>;
}
function TransitionTable({ transitions, label }: { transitions: { from: number; to: number; symbol: string }[]; label: (id: number) => string }) {
  return (
    <details><summary>Transition list ({transitions.length})</summary>
      <table className="mono"><thead><tr><th>From</th><th>Symbol</th><th>To</th></tr></thead>
        <tbody>{transitions.map((t, i) => <tr key={i}><td>{label(t.from)}</td><td>{t.symbol}</td><td>{label(t.to)}</td></tr>)}</tbody></table>
    </details>
  );
}

function Tree({ node }: { node: TreeNode }) {
  const text = node.type === 'symbol' ? `symbol '${node.value}'` : node.type;
  return <li><span className={`tree-node ${node.type}`}>{text}</span>{node.children.length > 0 && <ul>{node.children.map((c) => <Tree key={c.id} node={c} />)}</ul>}</li>;
}

function ParseView({ p }: { p: Pipeline }) {
  const steps = p.parse.steps;
  const player = usePlayer(steps.length, steps.length);
  const applied = steps.slice(0, player.index);
  const tokens = applied.filter((s) => s.kind === 'token');
  const forest = forestFromTrace(steps, player.index);
  return (
    <>
      <StepControls player={player} count={steps.length} label="Parser" />
      <Explain text={player.index === 0 ? 'Press Next to read the first token.' : explainParse(steps[player.index - 1] as StepEvent)} />
      <div className="two-col">
        <div><h3>Tokens</h3>
          {tokens.length === 0 ? <p className="muted">No tokens yet.</p> :
            <table className="mono" aria-label="Tokens"><thead><tr><th>#</th><th>Type</th><th>Value</th><th>Position</th></tr></thead>
              <tbody>{tokens.map((t, i) => <tr key={t.index}><td>{i + 1}</td><td>{String(t.payload.type)}</td><td>{String(t.payload.value)}</td><td>{(t.payload.position as number) + 1}</td></tr>)}</tbody></table>}
        </div>
        <div><h3>AST</h3>
          {forest.length === 0 ? <p className="muted">The tree grows as nodes are created.</p> : <ul className="tree" aria-label="Abstract syntax tree">{forest.map((n) => <Tree key={n.id} node={n} />)}</ul>}
        </div>
      </div>
    </>
  );
}

function NfaView({ p }: { p: Pipeline }) {
  const steps = p.nfa.steps;
  const player = usePlayer(steps.length, steps.length);
  const nfa = useMemo(() => nfaFromTrace(steps, player.index), [steps, player.index]);
  const cur = steps[player.index - 1];
  const fresh = cur?.kind === 'fragment' ? (cur.payload.newStates as number[]) : [];
  const g = nfaGraph(nfa);
  const full = p.nfa.result;
  return (
    <>
      <StepControls player={player} count={steps.length} label="Thompson" />
      <Explain text={cur ? explainNfa(cur) : 'Press Next to build the first fragment.'} />
      <Graph {...g} newStates={fresh} label={`NFA with ${g.states.length} states`} />
      <Info rows={[['states', String(nfa.states.size)], ['transitions', String(nfa.transitions.length)], ['alphabet', `{${full.alphabet().join(', ')}}`], ['start', nfa.start >= 0 ? `q${nfa.start}` : 'not set yet'], ['accepting', nfa.accepting.size ? [...nfa.accepting].map((x) => `q${x}`).join(', ') : 'not set yet']]} />
      <TransitionTable transitions={nfa.transitions} label={(i) => `q${i}`} />
    </>
  );
}

function DfaView({ p }: { p: Pipeline }) {
  const steps = p.dfa.steps;
  const player = usePlayer(steps.length, steps.length);
  const dfa = useMemo(() => dfaFromTrace(steps, player.index), [steps, player.index]);
  const cur = steps[player.index - 1];
  const fresh = cur?.kind === 'newState' ? [cur.payload.id as number] : cur?.kind === 'move' && cur.payload.isNew ? [cur.payload.to as number] : [];
  const g = dfaGraph(dfa);
  const active = cur?.kind === 'move' ? { from: cur.payload.from as number, to: cur.payload.to as number } : undefined;
  return (
    <>
      <StepControls player={player} count={steps.length} label="Subset construction" />
      <Explain text={cur ? explainDfa(cur) : 'Press Next to compute the ε-closure of the NFA start state.'} />
      {g.states.length > 0 ? <Graph {...g} newStates={fresh} activeEdge={active} label={`DFA with ${g.states.length} states`} /> : <p className="muted">The DFA appears after the first state is discovered.</p>}
      <table className="mono" aria-label="DFA states"><thead><tr><th>DFA state</th><th>NFA states</th><th>Accepting</th></tr></thead>
        <tbody>{[...dfa.states.values()].map((s) => <tr key={s.id}><td>{s.label}</td><td>{`{${s.members.map((m) => `q${m}`).join(', ')}}`}</td><td>{s.accepting ? 'yes' : 'no'}</td></tr>)}</tbody></table>
      <TransitionTable transitions={dfa.transitions} label={(i) => `D${i}`} />
    </>
  );
}

function MinView({ p }: { p: Pipeline }) {
  const steps = p.min.steps;
  const player = usePlayer(steps.length, steps.length);
  const cur = steps[player.index - 1];
  const dfa = p.min.result.dfa;
  const g = dfaGraph(dfa);
  const groups = (cur && cur.kind !== 'removeUnreachable' ? cur.payload.groups : undefined) as number[][] | undefined;
  return (
    <>
      <StepControls player={player} count={steps.length} label="Minimization" />
      <Explain text={cur ? explainMin(cur) : 'Press Next to remove unreachable states.'} />
      {groups && <ul className="partition mono" aria-label="Current partition">{groups.map((grp, i) => <li key={i}>{`{${grp.map((x) => `D${x}`).join(', ')}}`}</li>)}</ul>}
      <Graph {...g} label={`Minimized DFA with ${g.states.length} states (final result)`} />
      <Info rows={[['DFA states', String(p.dfa.result.states.size)], ['minimized states', String(dfa.states.size)], ['removed unreachable', p.min.result.removedUnreachable.length ? p.min.result.removedUnreachable.map((x) => `D${x}`).join(', ') : 'none']]} />
      <table className="mono" aria-label="Merged states"><thead><tr><th>Minimized state</th><th>Merged DFA states</th></tr></thead>
        <tbody>{[...dfa.states.values()].map((s) => <tr key={s.id}><td>{s.label}</td><td>{s.members.map((m) => `D${m}`).join(', ')}</td></tr>)}</tbody></table>
      <TransitionTable transitions={dfa.transitions} label={(i) => `M${i}`} />
    </>
  );
}

function RunView({ p }: { p: Pipeline }) {
  const [text, setText] = useState('abb');
  const [useMin, setUseMin] = useState(true);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const dfa = useMin ? p.min.result.dfa : p.dfa.result;
  const run = useMemo(() => (submitted === null ? null : runDfa(dfa, submitted)), [dfa, submitted]);
  const alphabet = dfa.alphabet();
  const unknown = submitted === null ? [] : [...new Set([...submitted].filter((c) => !alphabet.includes(c)))];
  return <RunBody key={`${submitted}-${useMin}`} p={p} dfa={dfa} run={run} unknown={unknown} alphabet={alphabet} text={text} setText={setText} useMin={useMin} setUseMin={setUseMin} onRun={() => setSubmitted(text)} />;
}

function RunBody({ dfa, run, unknown, alphabet, text, setText, useMin, setUseMin, onRun }: {
  p: Pipeline; dfa: Dfa; run: ReturnType<typeof runDfa> | null; unknown: string[]; alphabet: string[]; text: string; setText: (s: string) => void; useMin: boolean; setUseMin: (b: boolean) => void; onRun: () => void;
}) {
  const steps = run?.steps ?? [];
  const player = usePlayer(steps.length, 0);
  const label = (id: number) => dfa.states.get(id)?.label ?? String(id);
  const cur = steps[player.index - 1];
  const g = dfaGraph(dfa);
  const activeState = cur ? (cur.kind === 'step' ? (cur.payload.to as number) : (cur.payload.state ?? cur.payload.from) as number) : undefined;
  const activeEdge = cur?.kind === 'step' ? { from: cur.payload.from as number, to: cur.payload.to as number } : undefined;
  const finished = run && player.index >= steps.length;
  return (
    <>
      <div className="row">
        <label>Test string
          <input className="mono" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onRun()} aria-label="Test string" placeholder="leave empty to test the empty string" />
        </label>
        <label className="check"><input type="checkbox" checked={useMin} onChange={(e) => setUseMin(e.target.checked)} /> Use minimized DFA</label>
        <button className="primary" onClick={onRun}>Run</button>
      </div>
      <p className="muted mono">Alphabet of this automaton: {`{${alphabet.join(', ')}}`}</p>
      {unknown.length > 0 && <p className="warn" role="alert">Symbol{unknown.length > 1 ? 's' : ''} {unknown.map((u) => `'${u}'`).join(', ')} {unknown.length > 1 ? 'are' : 'is'} not in the alphabet, so the string will be rejected.</p>}
      {run ? (<>
        <StepControls player={player} count={steps.length} label="Acceptance" />
        <Explain text={cur ? explainRun(cur, label) : 'Press Next to take the first step.'} />
        <Graph {...g} activeState={activeState ?? dfa.start} activeEdge={activeEdge} rejected={cur?.kind === 'stuck' || (cur?.kind === 'end' && !cur.payload.accepted)} label="Automaton with current state highlighted" />
        {finished && (run.result.accepted
          ? <p className="verdict ok" role="status"><CheckCircle2 size={18} /> ACCEPTED</p>
          : <p className="verdict bad" role="status"><XCircle size={18} /> REJECTED</p>)}
      </>) : <p className="muted">Press Run to start stepping through the automaton.</p>}
    </>
  );
}

function ErrorPointer({ pattern, position, message }: { pattern: string; position: number; message: string }) {
  return (
    <div className="error" role="alert">
      <strong>{message}</strong>
      <div className="mono pointer" aria-hidden="true">
        {[...pattern].map((c, i) => <span key={i} className={i === position ? 'err-char' : ''}>{c}</span>)}
        {position >= pattern.length && <span className="err-char">␣</span>}
      </div>
      <span className="muted">At character {position + 1}.</span>
    </div>
  );
}

type Gen = { kind: 'ok'; pipeline: Pipeline; n: number } | { kind: 'error'; pattern: string; message: string; position: number | null } | { kind: 'empty' };

function generate(pattern: string, n: number): Gen {
  if (pattern === '') return { kind: 'empty' };
  try { return { kind: 'ok', pipeline: buildPipeline(pattern), n }; }
  catch (e) {
    if (e instanceof RegexSyntaxError) return { kind: 'error', pattern, message: e.message, position: e.position };
    return { kind: 'error', pattern, message: `Unexpected problem: ${(e as Error).message}`, position: null };
  }
}

export default function AutomataLab() {
  const [pattern, setPattern] = useState('(a|b)*abb');
  const [gen, setGen] = useState<Gen>(() => generate('(a|b)*abb', 0));
  const [counter, setCounter] = useState(1);
  const [view, setView] = useState<View>('nfa');
  const run = (p: string) => { setGen(generate(p, counter)); setCounter(counter + 1); };
  const about = ABOUT[view];
  return (
    <div className="page">
      <h1>Automata Lab</h1>
      <p className="lead">Turn a regular expression into an NFA, a DFA and a minimal DFA, then test strings against it.</p>
      <section className="panel" aria-label="Regular expression input">
        <div className="row">
          <label>Regular expression
            <input className="mono big" value={pattern} onChange={(e) => setPattern(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run(pattern)} aria-label="Regular expression" spellCheck={false} />
          </label>
          <button className="primary" onClick={() => run(pattern)}>Generate</button>
        </div>
        <div className="chips" role="group" aria-label="Example expressions">
          {EXAMPLES.map((e) => <button key={e} className="chip mono" onClick={() => { setPattern(e); run(e); }}>{e}</button>)}
        </div>
        <p className="muted small">Syntax: symbols, concatenation, <span className="mono">|</span>, <span className="mono">*</span>, parentheses, <span className="mono">ε</span> or <span className="mono">()</span> for the empty string. Not supported: classes, +, ?, escapes, spaces.</p>
      </section>

      {gen.kind === 'empty' && <p className="empty" role="status">Enter a regular expression above, or pick an example. Type <span className="mono">ε</span> for the empty pattern.</p>}
      {gen.kind === 'error' && (gen.position !== null ? <ErrorPointer pattern={gen.pattern} position={gen.position} message={gen.message} /> : <div className="error" role="alert">{gen.message}</div>)}
      {gen.kind === 'ok' && (
        <section className="panel" aria-label="Results">
          <div className="tabs" role="tablist">
            {TABS.map((t) => <button key={t.id} role="tab" aria-selected={view === t.id} className={view === t.id ? 'tab on' : 'tab'} onClick={() => setView(t.id)}>{t.label}</button>)}
          </div>
          <details className="about"><summary>What is this?</summary>
            <dl><dt>What</dt><dd>{about.what}</dd><dt>Why</dt><dd>{about.why}</dd><dt>Input</dt><dd>{about.input}</dd><dt>Algorithm</dt><dd>{about.algorithm}</dd><dt>Visualization</dt><dd>{about.shows}</dd></dl>
          </details>
          <div key={`${gen.n}-${view}`}>
            {view === 'parse' && <ParseView p={gen.pipeline} />}
            {view === 'nfa' && <NfaView p={gen.pipeline} />}
            {view === 'dfa' && <DfaView p={gen.pipeline} />}
            {view === 'min' && <MinView p={gen.pipeline} />}
            {view === 'run' && <RunView p={gen.pipeline} />}
          </div>
        </section>
      )}
      <p className="legend muted small"><span className="dot amber" /> start or current <span className="dot teal" /> accepting (double ring) <span className="dot red" /> rejected. Dashed edges are ε.</p>
    </div>
  );
}
