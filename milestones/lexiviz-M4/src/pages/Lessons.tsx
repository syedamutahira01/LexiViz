import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, SkipBack, SkipForward, Square } from 'lucide-react';
import { LESSONS } from '../lessons/lessons';
import { runStage, stageTimeline, type TimelineItem } from '../lessons/run';
import { audioStore } from '../audio/audioStore';
import { clearSubtitle, speak } from '../audio/narrator';

/** Runs the real algorithms on each stage's demo input; the cues only choose what to say and when. */
export default function Lessons() {
  const [lessonId, setLessonId] = useState(LESSONS[0]!.id);
  const lesson = LESSONS.find((l) => l.id === lessonId)!;
  const stages = useMemo(() => lesson.stages.map((st) => { const run = runStage(st); return { st, run, ...stageTimeline(st, run) }; }), [lesson]);
  const items: (TimelineItem & { demo: string })[] = stages.flatMap((s) => s.items.map((i) => ({ ...i, demo: s.st.demoInput ?? '' })));
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const token = useRef(0);
  useEffect(() => () => { token.current++; clearSubtitle(); }, []);
  useEffect(() => { token.current++; setPos(0); setPlaying(false); clearSubtitle(); }, [lessonId]);

  const cur = items[pos];
  const curStage = stages.find((s) => s.st.id === cur?.stageId);

  const playFrom = async (start: number) => {
    const my = ++token.current; setPlaying(true);
    for (let i = start; i < items.length; i++) {
      if (my !== token.current) return;
      setPos(i);
      await speak(items[i]!.cue, items[i]!.vars);
      if (my !== token.current) return;
      await new Promise((r) => setTimeout(r, 350));
    }
    if (my === token.current) setPlaying(false);
  };
  const jump = (i: number) => { token.current++; setPlaying(false); const n = Math.max(0, Math.min(items.length - 1, i)); setPos(n); void speak(items[n]!.cue, items[n]!.vars); };
  const stopAll = () => { token.current++; setPlaying(false); clearSubtitle(); };

  return (
    <div className="page">
      <h1>Lessons</h1>
      <p className="lead">Each lesson runs the real algorithm on a fixed example and explains the steps it takes, by voice and subtitles. Pick the language in the top bar.</p>
      {!audioStore.get().entered && <p className="muted small" role="note">Use the Enter button on the welcome screen to allow sound. Subtitles work either way.</p>}
      <div className="chips" role="group" aria-label="Lessons">
        {LESSONS.map((l) => <button key={l.id} className={`chip ${l.id === lessonId ? 'on' : ''}`} aria-pressed={l.id === lessonId} onClick={() => setLessonId(l.id)}>{l.title}</button>)}
      </div>
      <section className="panel" aria-label="Lesson player">
        <div className="controls" role="group" aria-label="Lesson controls">
          <button onClick={() => void playFrom(playing ? pos : pos >= items.length - 1 ? 0 : pos)} className="primary"><Play size={16} aria-hidden="true" /> {playing ? 'Restart from here' : 'Play lesson'}</button>
          <button onClick={() => jump(pos - 1)} disabled={pos === 0} aria-label="Previous cue"><SkipBack size={16} aria-hidden="true" /></button>
          <button onClick={() => jump(pos + 1)} disabled={pos >= items.length - 1} aria-label="Next cue"><SkipForward size={16} aria-hidden="true" /></button>
          <button onClick={stopAll} aria-label="Stop"><Square size={16} aria-hidden="true" /></button>
          <span className="muted small mono">cue {items.length ? pos + 1 : 0} of {items.length}</span>
        </div>
        {curStage && cur && (
          <>
            <p className="muted small">Stage <span className="mono">{curStage.st.id}</span> · algorithm <span className="mono">{curStage.st.algorithm}</span> · input <span className="mono">{curStage.st.demoInput}</span></p>
            <h3>Real trace ({curStage.run.steps.length} steps)</h3>
            <ol className="trace mono" aria-label="Algorithm trace">
              {curStage.run.steps.slice(0, 40).map((s) => <li key={s.index} className={s.index < cur.shown ? (s.index === cur.shown - 1 ? 'cur' : 'done') : ''}>{s.index}: {s.kind}</li>)}
              {curStage.run.steps.length > 40 && <li>… {curStage.run.steps.length - 40} more</li>}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}
