import { useMemo, useState } from 'react';
import { useResultNarration } from '../audio/useResultNarration';
import { useAudio } from '../audio/audioStore';
import { parserVars } from '../lessons/run';
import { lex, parseProgram, treeFromTrace, type LexResult, type StepEvent } from '../algorithms';
import { StepControls, usePlayer } from '../components/Stepper';
import { Explain, LineError, ParseTree } from '../components/Shared';
import { explainParseRule } from '../visual/explain';

const EXAMPLES = ['x = 10 + 20;', 'int total = (4 + 5) * 3;', 'a = 1 + 2 * 3;\nb = a - 1;', 'x = 10 + ;'];

function Tree({ source, lexed }: { source: string; lexed: LexResult }) {
  const audio = useAudio();
  const trace = useMemo(() => parseProgram(lexed.tokens, lexed.end), [lexed]);
  const steps = trace.steps.filter((s) => s.kind !== 'done');
  const player = usePlayer(steps.length, steps.length);
  const cur = steps[player.index - 1] as StepEvent | undefined;
  const tree = treeFromTrace(steps, player.index);
  const activeId = cur && (cur.kind === 'enter' || cur.kind === 'match') ? (cur.payload.id as number) : undefined;
  const { error } = trace.result;
  const finished = player.index >= steps.length;
  return (
    <>
      <StepControls player={player} count={steps.length} label="Parser" />
      <Explain text={cur ? explainParseRule(cur, audio.lang) : 'Press Next to enter the first rule.'} />
      <div className="chips mono" aria-label="Token stream">
        {lexed.tokens.map((t, i) => <span key={t.start} className={`chip tok ${cur && 'tokenIndex' in cur.payload && cur.payload.tokenIndex === i ? 'on' : ''}`}>{t.lexeme}</span>)}
      </div>
      <h3>Parse tree</h3>
      {tree ? <ul className="tree" aria-label="Parse tree"><ParseTree node={tree} activeId={activeId} /></ul> : <p className="muted">The tree grows in the order of the recursive calls.</p>}
      {finished && error && <LineError source={source} line={error.line} column={error.column} message={`Syntax error: ${error.message}`} />}
      {finished && !error && <p className="verdict ok" role="status">Valid program</p>}
    </>
  );
}

export default function ParserLab() {
  const [text, setText] = useState(EXAMPLES[0] as string);
  const [run, setRun] = useState<{ source: string; lexed: LexResult; n: number } | null>(() => { const s = EXAMPLES[0] as string; return { source: s, lexed: lex(s).result, n: 0 }; });
  const parsedOk = run && run.lexed.tokens.length > 0 && parseProgram(run.lexed.tokens, run.lexed.end).result.error === null;
  useResultNarration('parser', parsedOk && run ? parserVars(run.lexed.tokens) : null, run?.n);
  const go = (s: string) => setRun((r) => ({ source: s, lexed: lex(s).result, n: (r?.n ?? 0) + 1 }));
  return (
    <div className="page">
      <h1>Parser Lab</h1>
      <p className="lead">Turn tokens into a parse tree for a small language of declarations, assignments and arithmetic.</p>
      <section className="panel" aria-label="Source code input">
        <label>Source code
          <textarea className="mono" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} aria-label="Source code" spellCheck={false} />
        </label>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" onClick={() => go(text)}>Parse</button>
          <div className="chips" role="group" aria-label="Example programs" style={{ margin: 0 }}>
            {EXAMPLES.map((ex) => <button key={ex} className="chip mono" onClick={() => { setText(ex); go(ex); }}>{ex.split('\n')[0]}</button>)}
          </div>
        </div>
        <pre className="grammar mono small">{`Program     -> Statement*
Statement   -> Declaration | Assignment
Declaration -> TYPE IDENTIFIER ('=' Expr)? ';'     TYPE: int float char
Assignment  -> IDENTIFIER '=' Expr ';'
Expr        -> Term (('+' | '-') Term)*
Term        -> Factor (('*' | '/') Factor)*
Factor      -> INTEGER | IDENTIFIER | '(' Expr ')'`}</pre>
      </section>
      <details className="about panel"><summary>What is this?</summary>
        <dl><dt>What</dt><dd>The token stream is checked against a grammar and arranged into a tree.</dd><dt>Why</dt><dd>The tree shows structure, for example that * is grouped before +.</dd><dt>Input</dt><dd>Tokens from the lexer.</dd><dt>Algorithm</dt><dd>Recursive descent: one function per grammar rule, each calling the rules it contains.</dd><dt>Visualization</dt><dd>The tree grows in the order of the recursive calls. Amber marks the newest node.</dd></dl>
      </details>
      {run === null ? <p className="empty" role="status">Enter source code above and press Parse.</p> : run.lexed.errors.length > 0 ? (
        <section className="panel" aria-label="Lexical errors">
          <p className="warn" role="alert">The lexer found {run.lexed.errors.length} invalid character{run.lexed.errors.length > 1 ? 's' : ''}. Fix {run.lexed.errors.length > 1 ? 'them' : 'it'} before parsing.</p>
          <ul>{run.lexed.errors.map((e) => <li key={e.start}>{e.message} at line {e.line}, column {e.column}</li>)}</ul>
        </section>
      ) : <section className="panel" aria-label="Results"><div key={run.n}><Tree source={run.source} lexed={run.lexed} /></div></section>}
    </div>
  );
}
