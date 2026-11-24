/** Browser-side settings and capability checks for the 3D layer. Every browser API call is guarded. */
import { useSyncExternalStore } from 'react';
import { chooseSceneMode, type SceneMode } from './rigMath';

const KEY = 'lexiviz.scene3d';
const listeners = new Set<() => void>();
let failed = false;
let webglCache: boolean | null = null;

export function readUserOff(): boolean {
  try { return localStorage.getItem(KEY) === 'off'; } catch { return false; }
}
export function setUserOff(off: boolean): void {
  try { localStorage.setItem(KEY, off ? 'off' : 'on'); } catch { /* storage may be blocked; the setting then lasts only for this session */ }
  sessionOff = off;
  listeners.forEach((l) => l());
}
let sessionOff: boolean | null = null;
const currentOff = () => (sessionOff !== null ? sessionOff : readUserOff());
/** The effective setting: this session's choice if one was made, otherwise what storage holds. */
export const currentUserOff = currentOff;

export function markSceneFailed(): void { failed = true; listeners.forEach((l) => l()); }
export function resetSceneFailure(): void { failed = false; listeners.forEach((l) => l()); }

export function detectWebgl(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const canvas = document.createElement('canvas');
    webglCache = Boolean(canvas.getContext?.('webgl2') ?? canvas.getContext?.('webgl'));
  } catch { webglCache = false; }
  return webglCache;
}
export const _resetWebglCacheForTests = () => { webglCache = null; sessionOff = null; failed = false; };

const saveData = (): boolean => {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(c?.saveData);
};

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const snapshot = () => `${currentOff() ? 1 : 0}${failed ? 1 : 0}`;

export function useSceneMode(): SceneMode {
  useSyncExternalStore(subscribe, snapshot);
  return chooseSceneMode({ webglAvailable: detectWebgl(), userOff: currentOff(), saveData: saveData(), failed });
}
export function useUserOff(): boolean {
  useSyncExternalStore(subscribe, snapshot);
  return currentOff();
}
