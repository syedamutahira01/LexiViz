/** Tiny external store for the navigator selection, shared by the DOM list and the 3D boxes. Pure TypeScript. */
import type { PhaseId } from '../data/phases';

export interface SceneUi { selected: PhaseId | null; hovered: PhaseId | null }
let state: SceneUi = { selected: null, hovered: null };
const listeners = new Set<() => void>();

export const getSceneUi = (): SceneUi => state;
export function subscribeSceneUi(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function set(next: Partial<SceneUi>) {
  const merged = { ...state, ...next };
  if (merged.selected === state.selected && merged.hovered === state.hovered) return;
  state = merged;
  listeners.forEach((l) => l());
}
export const setSelected = (id: PhaseId | null) => set({ selected: id });
export const setHovered = (id: PhaseId | null) => set({ hovered: id });
export const resetSceneUi = () => { state = { selected: null, hovered: null }; listeners.forEach((l) => l()); };
