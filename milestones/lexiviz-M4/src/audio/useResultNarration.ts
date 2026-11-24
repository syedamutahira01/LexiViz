import { useEffect } from 'react';
import type { Vars } from '../lessons/types';
import { resultCue } from '../lessons/lessons';
import { audioStore } from './audioStore';
import { speak } from './narrator';

/**
 * Speaks the result cue of a stage after the user has entered and narration is on.
 * `vars` come from the lab's own real result; `key` changes whenever a new result is produced.
 */
export function useResultNarration(stageId: string | null, vars: Vars | null, key: unknown): void {
  useEffect(() => {
    const s = audioStore.get();
    if (!stageId || !vars || !s.entered || !s.narrationOn) return;
    const cue = resultCue(stageId);
    if (cue) void speak(cue, vars);
    // vars is derived from the same result as key, so key is the right trigger
  }, [stageId, key]); // eslint-disable-line
}
