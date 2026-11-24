/** Browser glue: starts music after the Enter click, keeps its level in step with the settings and ducks it for narration. */
import { useEffect } from 'react';
import { audioStore } from './audioStore';
import { musicGain } from './ambient';
import { MusicEngine } from './music';
import { stop } from './narrator';

const engine = new MusicEngine();
let hidden = false;

const apply = () => {
  const s = audioStore.get();
  engine.setLevel(musicGain(s.volume, s.musicOn, s.speaking === 'voice'));
};

export async function enter(opts: { sound: boolean }): Promise<void> {
  if (!opts.sound) audioStore.set({ entered: true, musicOn: false, narrationOn: false });
  else audioStore.set({ entered: true });
  if (!opts.sound) return;
  apply();
  const src = await engine.start();
  audioStore.set({ musicSource: src, notice: src === 'none' ? 'Music could not start in this browser. Everything else still works.' : audioStore.get().notice });
  apply();
}

/** Mount once. Re-applies levels on every settings change and pauses everything when the tab is hidden. */
export function useAudioController(): void {
  useEffect(() => {
    const unsub = audioStore.subscribe(apply);
    const onVis = () => { hidden = document.visibilityState === 'hidden'; engine.setSuspended(hidden); if (hidden) stop(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { unsub(); document.removeEventListener('visibilitychange', onVis); };
  }, []);
}
export const _engineForTests = engine;
