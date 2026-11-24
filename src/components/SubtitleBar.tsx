import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, RotateCcw, SkipForward, X } from 'lucide-react';
import { useAudio } from '../audio/audioStore';
import { clearSubtitle, pause, replay, resume, skip } from '../audio/narrator';
import { subtitleLines } from '../audio/narration';

/**
 * Subtitles are shown for the current cue, in one or two languages.
 * Automatically dismisses after narration finishes so it does not block page content,
 * and includes a close button and minimize toggle for the user.
 */
export function SubtitleBar() {
  const a = useAudio();
  const [minimized, setMinimized] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }

    // Auto-dismiss 5 seconds after narration finishes if not hovered
    if (a.current && a.speaking === 'idle' && !isHovered) {
      dismissTimer.current = setTimeout(() => {
        clearSubtitle();
      }, 5000);
    }

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [a.speaking, a.current, isHovered]);

  if (!a.current) return null;
  const lines = subtitleLines(a.current.cue, a.current.vars, a.lang, a.lang2);
  const busy = a.speaking !== 'idle';
  const firstLine = lines[0]?.text ?? '';

  if (minimized) {
    return (
      <div
        className="subtitle-bar-minimized panel"
        role="region"
        aria-label="Subtitles (minimized)"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button
          type="button"
          className="subtitle-min-btn"
          onClick={() => setMinimized(false)}
          title="Expand subtitle"
          aria-label="Expand subtitle"
        >
          <ChevronUp size={14} aria-hidden="true" />
          <span className="subtitle-preview">{firstLine.slice(0, 50)}{firstLine.length > 50 ? '...' : ''}</span>
        </button>
        <button
          type="button"
          className="subtitle-close-btn"
          onClick={clearSubtitle}
          title="Close subtitle"
          aria-label="Close subtitle"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="subtitle-bar panel"
      role="region"
      aria-label="Subtitles"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="subtitle-header">
        <div role="status" aria-live="polite" className="subtitle-content">
          {lines.map((l) => (
            <p key={l.lang} className="subtitle" dir={l.dir} lang={l.lang === 'ur-roman' ? 'ur-Latn' : l.lang} style={{ fontFamily: l.font === 'inherit' ? undefined : l.font }}>
              {l.text}
              {l.review === 'ai-translated' && <span className="badge"> AI-translated</span>}
            </p>
          ))}
        </div>
        <div className="subtitle-actions">
          <button
            type="button"
            className="subtitle-action-btn"
            onClick={() => setMinimized(true)}
            title="Minimize subtitles"
            aria-label="Minimize subtitles"
          >
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="subtitle-action-btn close-btn"
            onClick={clearSubtitle}
            title="Close subtitles"
            aria-label="Close subtitles"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      {a.notice && <p className="muted small">{a.notice}</p>}
      <div className="controls" role="group" aria-label="Narration controls">
        <button type="button" onClick={() => void replay()} aria-label="Replay"><RotateCcw size={16} aria-hidden="true" /></button>
        {a.speaking === 'paused'
          ? <button type="button" onClick={resume} aria-label="Resume"><Play size={16} aria-hidden="true" /></button>
          : <button type="button" onClick={pause} disabled={!busy} aria-label="Pause"><Pause size={16} aria-hidden="true" /></button>}
        <button type="button" onClick={skip} disabled={!busy} aria-label="Skip"><SkipForward size={16} aria-hidden="true" /></button>
      </div>
    </div>
  );
}
