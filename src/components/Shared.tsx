import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { ParseNode } from '../algorithms';
import { useAudio } from '../audio/audioStore';
import { speakText, stop } from '../audio/narrator';

export function Explain({ text, label }: { text: string; label?: string }) {
  const audio = useAudio();
  const [autoNarrate, setAutoNarrate] = useState(false);
  const isUrdu = /[\u0600-\u06FF]/.test(text);
  const prevText = useRef(text);
  const isSpeaking = audio.speaking === 'voice' || audio.speaking === 'captions';

  useEffect(() => {
    if (autoNarrate && text && text !== prevText.current && audio.entered && audio.narrationOn) {
      void speakText(text);
    }
    prevText.current = text;
  }, [text, autoNarrate, audio.entered, audio.narrationOn]);

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      stop();
    } else {
      void speakText(text);
    }
  };

  return (
    <div className="explain-card" aria-label={label ?? 'Step explanation'}>
      <p
        className="explain"
        dir={isUrdu ? 'rtl' : 'ltr'}
        style={{
          fontFamily: isUrdu ? '"Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Noto Naskh Arabic", serif' : undefined,
          lineHeight: isUrdu ? 1.8 : undefined,
        }}
        aria-live="polite"
      >
        {text}
      </p>
      <div className="explain-toolbar">
        <button
          type="button"
          className="explain-speak-btn"
          onClick={handleToggleSpeak}
          title={isSpeaking ? 'Stop narration' : 'Narrate this step in active language'}
          aria-label={isSpeaking ? 'Stop narration' : 'Narrate step'}
        >
          {isSpeaking ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
          <span>{isSpeaking ? 'Stop voice' : '🔊 Narrate step'}</span>
        </button>
        <label className="auto-narrate-label" title="Automatically narrate every step as you advance">
          <input
            type="checkbox"
            checked={autoNarrate}
            onChange={(e) => setAutoNarrate(e.target.checked)}
          />
          Auto-narrate steps
        </label>
      </div>
    </div>
  );
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
      <span className={'tree-node ' + node.kind + (node.id === activeId ? ' active' : '')}>{node.label}</span>
      {node.children.length > 0 && <ul>{node.children.map((c) => <ParseTree key={c.id} node={c} activeId={activeId} />)}</ul>}
    </li>
  );
}
