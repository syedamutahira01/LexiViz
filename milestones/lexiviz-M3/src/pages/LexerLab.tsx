import { useMemo, useState } from 'react';
import { buildSymbolTable, lex, type StepEvent } from '../algorithms';
import { StepControls, usePlayer } from '../components/Stepper';
import { Explain, SourceView } from '../components/Shared';
import { explainLex } from '../visual/explain';

const EXAMPLES = ['int total = 25;', 'x = 10 + 20;', 'float price;\nprice = 3;\nint count = price * 2;', 'int a = 5 @ 6;'];
const MAX = 2000;

function Result({ source }: { source: string }) {
  const trace = useMemo(() => lex(source), [source]);
  const steps = trace.steps.filter((s) => s.kind === 'token' || s.kind === 'error');
  const player = usePlayer(steps.length, steps.length);
  const applied = steps.slice(0, player.index);
  const cur = applied[applied.length - 1] as StepEvent | undefined;
  const tokens = trace.result.tokens.filter((t) => applied.some((s) => s.kind === 'token' && s.payload.start === t.start));
  const errors = trace.result.errors.filter((e) => applied.some((s) => s.kind === 'error' && s.payload.start === e.start));
  // the symbol table is a separate algorithm; here it is run on the tokens scanned so far
  const symbols = useMemo(() => buildSymbolTable(tokens).result, [tokens]);
  const current = cur ? { start: cur.payload.start as number, end: cur.kind === 'token' ? (cur.payload.end as number) : (cur.payload.start as number) + (cur.payload.char as string).length, error: cur.kind === 'error' } : undefined;
  const consumedTo = current ? current.end : 0;

  if (steps.length === 0) return <p className="empty" role="status">Nothing to scan: the source has no tokens. Type some code or pick an example.</p>;
  return (
    <>
      <StepControls player={player} count={steps.length} label="Lexer" />
      <Explain text={cur ? explainLex(cur) : 'Press Next to scan the first lexeme.'} />
      <SourceView source={source} current={current} consumedTo={consumedTo} errorAt={errors.map((e) => e.start)} label="Source code with the scan position highlighted" />
      {errors.length > 0 && (
        <ul className="error" role="alert" aria-label="Lexical errors">
          {errors.map((e) => <li key={e.start}><strong>{e.message}</strong> at line {e.line}, column {e.column}</li>)}
        </ul>
      )}
      <div className="two-col">
        <div><h3>Tokens</h3>
          {tokens.length === 0 ? <p className="muted">No tokens yet.</p> :
            <table className="mono" aria-label="Tokens"><thead><tr><th>#</th><th>Token</th><th>Lexeme</th><th>Line</th><th>Col</th></tr></thead>
              <tbody>{tokens.map((t, i) => <tr key={t.start} className={t.start === current?.start ? 'row-cur' : ''}><td>{i + 1}</td><td>{t.type}</td><td>{t.lexeme}</td><td>{t.line}</td><td>{t.column}</td></tr>)}</tbody></table>}
        </div>
        <div><h3>Symbol table</h3>
          {symbols.length === 0 ? <p className="muted">No identifiers yet.</p> :
            <table className="mono" aria-label="Symbol table"><thead><tr><th>Name</th><th>Token</th><th>Type</th><th>Value</th><th>Line</th></tr></thead>
              <tbody>{symbols.map((s) => <tr key={s.name}><td>{s.name}</td><td>{s.token}</td><td>{s.type}</td><td>{s.value ?? '—'}</td><td>{s.line}</td></tr>)}</tbody></table>}
          <p className="muted small">Built by a separate step from the tokens above. A value is stored only for integer literals.</p>
        </div>
      </div>
    </>
  );
}

export default function LexerLab() {
  const [text, setText] = useState(EXAMPLES[0] as string);
  const [source, setSource] = useState<string | null>(EXAMPLES[0] as string);
  const [n, setN] = useState(0);
  const run = (s: string) => { setSource(s); setN((x) => x + 1); };
  return (
    <div className="page">
      <h1>Lexer Lab</h1>
      <p className="lead">Split source code into tokens. At each position every rule is tried and the longest match wins.</p>
      <section className="panel" aria-label="Source code input">
        <label>Source code
          <textarea className="mono" rows={4} maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)} aria-label="Source code" spellCheck={false} />
        </label>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" onClick={() => run(text)}>Scan</button>
          <div className="chips" role="group" aria-label="Example programs" style={{ margin: 0 }}>
            {EXAMPLES.map((ex) => <button key={ex} className="chip mono" onClick={() => { setText(ex); run(ex); }}>{ex.split('\n')[0]}</button>)}
          </div>
        </div>
        <p className="muted small">Tokens: KEYWORD (int float char if else while return for), IDENTIFIER, INTEGER, ASSIGNMENT, OPERATOR (+ - * / &lt; &gt; == != &lt;= &gt;=), SEMICOLON, COMMA, parentheses and braces. Not supported: comments, strings, decimals. Limit {MAX} characters.</p>
      </section>
      <details className="about panel"><summary>What is this?</summary>
        <dl><dt>What</dt><dd>Source text is cut into lexemes, and each lexeme gets a token type.</dd><dt>Why</dt><dd>The parser works on tokens, not characters.</dd><dt>Input</dt><dd>The source code.</dd><dt>Algorithm</dt><dd>Rule-based longest match with line and column tracking. The symbol table is a separate structure filled from the tokens.</dd><dt>Visualization</dt><dd>The amber text is the lexeme being read, and the tables fill as the scan moves.</dd></dl>
      </details>
      {source === null ? <p className="empty" role="status">Enter source code above and press Scan.</p> : <section className="panel" aria-label="Results"><div key={n}><Result source={source} /></div></section>}
    </div>
  );
}
