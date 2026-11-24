/** Audio settings (persisted) and runtime state (not persisted). Plain store, read in React with useAudio(). */
import { useSyncExternalStore } from 'react';
import type { NarrationCue, Vars } from '../lessons/types';
import { DEFAULT_LANG, hasLanguage } from './languages';

const KEY = 'lexiviz.audio';
export interface AudioSettings { musicOn: boolean; volume: number; narrationOn: boolean; lang: string; lang2: string; speed: number }
export interface AudioRuntime {
  entered: boolean;
  speaking: 'idle' | 'voice' | 'captions' | 'paused';
  current: { cue: NarrationCue; vars: Vars } | null;
  notice: string | null;
  musicSource: 'none' | 'file' | 'synth';
}
export type AudioState = AudioSettings & AudioRuntime;

export const DEFAULT_SETTINGS: AudioSettings = { musicOn: true, volume: 0.2, narrationOn: true, lang: DEFAULT_LANG, lang2: '', speed: 1 };
export const SPEEDS = [0.75, 1, 1.25, 1.5];

export function sanitize(raw: unknown): AudioSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const num = (v: unknown, lo: number, hi: number, fb: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb);
  const lang = typeof o.lang === 'string' && hasLanguage(o.lang) ? o.lang : d.lang;
  const lang2 = typeof o.lang2 === 'string' && hasLanguage(o.lang2) ? o.lang2 : '';
  return { musicOn: typeof o.musicOn === 'boolean' ? o.musicOn : d.musicOn, volume: num(o.volume, 0, 1, d.volume),
    narrationOn: typeof o.narrationOn === 'boolean' ? o.narrationOn : d.narrationOn, lang, lang2, speed: num(o.speed, 0.75, 1.5, d.speed) };
}
function load(): AudioSettings {
  try { return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null')); } catch { return { ...DEFAULT_SETTINGS }; }
}
const runtime0: AudioRuntime = { entered: false, speaking: 'idle', current: null, notice: null, musicSource: 'none' };

let state: AudioState = { ...load(), ...runtime0 };
const listeners = new Set<() => void>();
const SETTING_KEYS: (keyof AudioSettings)[] = ['musicOn', 'volume', 'narrationOn', 'lang', 'lang2', 'speed'];

export const audioStore = {
  get: (): AudioState => state,
  set(patch: Partial<AudioState>) {
    const next = { ...state, ...patch };
    if ((Object.keys(patch) as (keyof AudioState)[]).every((k) => state[k] === next[k])) return;
    state = next;
    if (SETTING_KEYS.some((k) => k in patch)) {
      try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(SETTING_KEYS.map((k) => [k, state[k]])))); } catch { /* storage blocked: settings last for this session */ }
    }
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  /** Test helper. */
  reset(patch: Partial<AudioState> = {}) { state = { ...DEFAULT_SETTINGS, ...runtime0, ...patch }; listeners.forEach((l) => l()); },
};
export const useAudio = (): AudioState => useSyncExternalStore(audioStore.subscribe, audioStore.get, audioStore.get);
