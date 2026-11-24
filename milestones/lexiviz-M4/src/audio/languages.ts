/** Language registry. Adding a language is data only: add an entry to languages.json and cue text/audio. */
import data from './languages.json';

export type ReviewStatus = 'original' | 'ai-translated' | 'human-reviewed';
export interface LanguageInfo {
  code: string; label: string; dir: 'ltr' | 'rtl'; ttsLocale: string; font: string; review: ReviewStatus;
}
export const LANGUAGES: LanguageInfo[] = data.languages as LanguageInfo[];
export const DEFAULT_LANG = 'en';
export const getLanguage = (code: string): LanguageInfo => LANGUAGES.find((l) => l.code === code) ?? (LANGUAGES[0] as LanguageInfo);
export const hasLanguage = (code: string) => LANGUAGES.some((l) => l.code === code);
