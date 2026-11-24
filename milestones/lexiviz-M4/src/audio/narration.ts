/** Pure narration logic: template filling, language fallback, subtitle lines. No browser APIs. */
import type { LangCode, NarrationCue, Vars } from '../lessons/types';
import { DEFAULT_LANG, getLanguage } from './languages';

/** Replaces {name} with the real value. An unknown placeholder is left visible so a bug is easy to spot. */
export function fillTemplate(template: string, vars: Vars): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (Object.hasOwn(vars, k) ? String(vars[k]) : m));
}
export const placeholdersOf = (template: string): string[] => [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string);

export interface Resolved { lang: LangCode; subtitle: string; voice: string; fellBack: boolean }

/** The cue text for a language, filled with real values. Falls back to English when the language has no text. */
export function resolveCue(cue: NarrationCue, lang: LangCode, vars: Vars): Resolved {
  const own = cue.text[lang];
  const used = own ? lang : DEFAULT_LANG;
  const t = (own ?? cue.text[DEFAULT_LANG]) as { subtitle: string; voiceText?: string };
  const subtitle = fillTemplate(t.subtitle, vars);
  return { lang: used, subtitle, voice: fillTemplate(t.voiceText ?? t.subtitle, vars), fellBack: !own };
}

export interface SubtitleLine { lang: LangCode; text: string; dir: 'ltr' | 'rtl'; font: string; review: string; fellBack: boolean }

/** One or two subtitle lines. The second language is skipped when empty, equal to the first, or untranslated. */
export function subtitleLines(cue: NarrationCue, vars: Vars, lang: LangCode, lang2: LangCode): SubtitleLine[] {
  const line = (code: LangCode, r: Resolved): SubtitleLine => {
    const info = getLanguage(r.lang);
    return { lang: code, text: r.subtitle, dir: info.dir, font: info.font, review: info.review, fellBack: r.fellBack };
  };
  const out = [line(lang, resolveCue(cue, lang, vars))];
  if (lang2 && lang2 !== lang && cue.text[lang2]) out.push(line(lang2, resolveCue(cue, lang2, vars)));
  return out;
}

/** How long to show captions when there is no voice: reading time, scaled by the speed setting. */
export const captionMs = (text: string, speed: number) => Math.round(Math.min(9000, Math.max(1800, text.length * 65)) / Math.max(0.5, speed));

/** 32-bit FNV-1a. The generator script uses the same function, so audio can be matched to text. */
export function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
