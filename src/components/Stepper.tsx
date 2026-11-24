import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';

/** Step controls state. `index` is the number of trace steps applied, from 0 to `count`. */
export function usePlayer(count: number, initial: number) {
  const [index, setIndex] = useState(initial);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    if (!playing) return;
    if (index >= count) { setPlaying(false); return; }
    const t = setTimeout(() => setIndex((i) => Math.min(count, i + 1)), 900 / speed);
    return () => clearTimeout(t);
  }, [playing, index, count, speed]);
  return {
    index, speed, playing, setSpeed,
    set: (i: number) => setIndex(Math.max(0, Math.min(count, i))),
    next: () => { setPlaying(false); setIndex((i) => Math.min(count, i + 1)); },
    prev: () => { setPlaying(false); setIndex((i) => Math.max(0, i - 1)); },
    reset: () => { setPlaying(false); setIndex(0); },
    toggle: () => { if (index >= count) setIndex(0); setPlaying((p) => !p); },
  };
}
export type Player = ReturnType<typeof usePlayer>;

export function StepControls({ player, count, label }: { player: Player; count: number; label: string }) {
  return (
    <div className="controls" role="group" aria-label={`${label} step controls`}>
      <button onClick={player.reset} aria-label="Reset"><RotateCcw size={16} /></button>
      <button onClick={player.prev} disabled={player.index === 0} aria-label="Previous step"><ChevronLeft size={16} /></button>
      <button onClick={player.toggle} aria-label={player.playing ? 'Pause' : 'Play'}>{player.playing ? <Pause size={16} /> : <Play size={16} />}</button>
      <button onClick={player.next} disabled={player.index >= count} aria-label="Next step"><ChevronRight size={16} /></button>
      <span className="mono" aria-live="polite">step {player.index} / {count}</span>
      <label className="speed">Speed
        <select value={player.speed} onChange={(e) => player.setSpeed(Number(e.target.value))} aria-label="Speed">
          {[0.5, 1, 2, 4].map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </label>
    </div>
  );
}
