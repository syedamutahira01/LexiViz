import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PHASES } from '../data/phases';
import { setSelected } from '../scene/sceneStore';
import { useSceneUi } from '../scene/useSceneUi';

/**
 * The phase list is the primary, keyboard-accessible control and also the non-3D fallback.
 * When the 3D scene is on, the same selection focuses the matching box in the ring.
 */
export function PipelineNavigator() {
  const { selected } = useSceneUi();
  const phase = PHASES.find((p) => p.id === selected);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); setSelected(null); };
  }, []);
  return (
    <section id="pipeline" className="pipeline" aria-labelledby="pipeline-title">
      <div className="pipeline-intro">
        <h2 id="pipeline-title">The compiler pipeline</h2>
        <p className="muted">Six phases turn source code into a program. Pick one, or click its numbered box in the ring.</p>
      </div>
      <div className="pipeline-side">
        <ol className="phase-list" aria-label="Compiler phases">
          {PHASES.map((p, i) => (
            <li key={p.id}>
              <button className={selected === p.id ? 'phase on' : 'phase'} aria-pressed={selected === p.id} onClick={() => setSelected(selected === p.id ? null : p.id)}>
                <span className="phase-no mono">{i + 1}</span>
                <span className="phase-name">{p.name}<span className={p.lab ? 'badge lab' : 'badge'}>{p.lab ? 'Lab' : 'Theory'}</span></span>
              </button>
            </li>
          ))}
        </ol>
      <aside className="panel phase-panel" aria-live="polite" aria-label="Phase details">
        {phase ? (
          <>
            <h3>{PHASES.indexOf(phase) + 1}. {phase.name}</h3>
            <dl>
              <dt>What it does</dt><dd>{phase.what}</dd>
              <dt>Why it exists</dt><dd>{phase.why}</dd>
              <dt>Input</dt><dd>{phase.input}</dd>
              <dt>Output</dt><dd>{phase.output}</dd>
              <dt>How it works</dt><dd>{phase.how}</dd>
            </dl>
            {phase.lab ? <Link className="primary-link" to={phase.lab}>Open the {phase.id === 'lexical' ? 'Lexer' : 'Parser'} Lab</Link> : <span className="badge">Theory only: not implemented in LexiViz</span>}
            <button className="link-button" onClick={() => setSelected(null)}>Close (Esc)</button>
          </>
        ) : <p className="muted">Select a phase to see what it does, why it exists, its input and output, and how it works.</p>}
      </aside>
      </div>
    </section>
  );
}
