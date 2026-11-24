import type { ParseNode } from '../algorithms';

export function Explain({ text }: { text: string }) {
  return <p className="explain" aria-live="polite">{text}</p>;
}

/** Source text with the consumed part bright, the current token amber, and error characters red. */
export function SourceView({ source, current, consumedTo, errorAt = [], label }: { source: string; current?: { start: number; end: number; error?: boolean }; consumedTo: number; errorAt?: number[]; label: string }) {
  return (
    <pre className="source mono" aria-label={label}>
      {[...source].map((ch, i) => {
        const cls = current && i >= current.start && i < current.end ? (current.error ? 'src-err' : 'src-cur') : errorAt.includes(i) ? 'src-err' : i < consumedTo ? 'src-done' : 'src-todo';
        return <span key={i} className={cls}>{ch}</span>;
      })}
    </pre>
  );
}

/** Shows the offending line with a marker under the column. */
export function LineError({ source, line, column, message }: { source: string; line: number; column: number; message: string }) {
  const text = source.split('\n')[line - 1]?.replace(/\r$/, '') ?? '';
  return (
    <div className="error" role="alert">
      <strong>{message}</strong>
      <pre className="mono pointer" aria-hidden="true">{text}{'\n'}{' '.repeat(Math.max(0, column - 1))}^</pre>
      <span className="muted">Line {line}, column {column}.</span>
    </div>
  );
}

export function ParseTree({ node, activeId }: { node: ParseNode; activeId?: number }) {
  return (
    <li>
      <span className={`tree-node ${node.kind} ${node.id === activeId ? 'active' : ''}`}>{node.label}</span>
      {node.children.length > 0 && <ul>{node.children.map((c) => <ParseTree key={c.id} node={c} activeId={activeId} />)}</ul>}
    </li>
  );
}
