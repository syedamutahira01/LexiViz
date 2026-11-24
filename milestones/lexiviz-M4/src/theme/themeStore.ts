/** Theme state: supports 'ice-cream' (light beige) and 'chocolate' (warm chocolate brown). */
import { useSyncExternalStore } from 'react';

export type ThemeMode = 'ice-cream' | 'chocolate';

const KEY = 'lexiviz.theme';
export const DEFAULT_THEME: ThemeMode = 'ice-cream';

function loadTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'ice-cream' || saved === 'chocolate') return saved;
  } catch {}
  return DEFAULT_THEME;
}

let currentTheme: ThemeMode = typeof window !== 'undefined' ? loadTheme() : DEFAULT_THEME;
const listeners = new Set<() => void>();

export function applyTheme(theme: ThemeMode) {
  currentTheme = theme;
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  listeners.forEach((l) => l());
}

if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', currentTheme);
}

export const themeStore = {
  get: (): ThemeMode => currentTheme,
  set: (theme: ThemeMode) => applyTheme(theme),
  toggle: () => applyTheme(currentTheme === 'ice-cream' ? 'chocolate' : 'ice-cream'),
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

export function useTheme(): ThemeMode {
  return useSyncExternalStore(themeStore.subscribe, themeStore.get, () => DEFAULT_THEME);
}
