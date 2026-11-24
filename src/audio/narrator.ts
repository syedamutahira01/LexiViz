/**
 * Narration engine. Voice sources, in order:
 *  1. pre-generated audio (public/audio/<lang>/<cueId>.mp3, listed in manifest.json) for fixed cues,
 *  2. online TTS API streaming (via /api/tts proxy or Google TTS) for dynamic results, explanations, and native Urdu/English voices,
 *  3. the browser's SpeechSynthesis for installed system voices,
 *  4. captions only, with a notice, when the device has no voice and is offline.
 * Only one cue is ever active: a new cue replaces the current one.
 */
import type { NarrationCue, Vars } from '../lessons/types';
import { audioStore } from './audioStore';
import { getLanguage } from './languages';
import { captionMs, resolveCue, textHash } from './narration';

interface Manifest { entries: Record<string, { hash: string }> }
let manifest: Promise<Manifest> | null = null;
const loadManifest = (): Promise<Manifest> => (manifest ??= fetch('/audio/manifest.json')
  .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? (r.json() as Promise<Manifest>) : { entries: {} }))
  .catch(() => ({ entries: {} })));
export const _resetManifestForTests = () => { manifest = null; };

interface Active { id: number; cancel: () => void; pause: () => void; resume: () => void; setRate: (r: number) => void }
let active: Active | null = null;
let seq = 0;
let last: { cue: NarrationCue; vars: Vars } | null = null;

const synth = (): SpeechSynthesis | null => (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);

/** Splits text into natural sentence or phrase chunks within maxLen characters for TTS streaming. */
function splitText(text: string, maxLen = 140): string[] {
  if (text.length <= maxLen) return [text];
  const parts: string[] = [];
  const sentences = text.match(/[^.!?\u06d4]+[.!?\u06d4]+|[^.!?\u06d4]+/g) || [text];
  let cur = '';
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if ((cur + ' ' + trimmed).trim().length <= maxLen) {
      cur = (cur + ' ' + trimmed).trim();
    } else {
      if (cur) parts.push(cur);
      if (trimmed.length > maxLen) {
        const words = trimmed.split(/\s+/);
        cur = '';
        for (const w of words) {
          if ((cur + ' ' + w).trim().length <= maxLen) {
            cur = (cur + ' ' + w).trim();
          } else {
            if (cur) parts.push(cur);
            cur = w;
          }
        }
      } else {
        cur = trimmed;
      }
    }
  }
  if (cur) parts.push(cur);
  return parts.length ? parts : [text];
}

/** A voice whose language matches the locale (exact match preferred, then the same base language). */
export function pickVoice(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | null {
  const l = locale.toLowerCase(); const base = l.split('-')[0] as string;
  return voices.find((v) => v.lang.toLowerCase().replace('_', '-') === l) ?? voices.find((v) => v.lang.toLowerCase().startsWith(base)) ?? null;
}

export function stop(): void { const a = active; active = null; a?.cancel(); synth()?.cancel(); if (audioStore.get().speaking !== 'idle') audioStore.set({ speaking: 'idle' }); }

export async function speak(cue: NarrationCue, vars: Vars = {}): Promise<void> {
  stop();
  const id = ++seq; last = { cue, vars };
  const s = audioStore.get();
  const r = resolveCue(cue, s.lang, vars);
  const info = getLanguage(r.lang);
  const notices: string[] = [];
  if (r.fellBack && s.lang !== 'en') notices.push(`${getLanguage(s.lang).label} text is not available for this cue; showing English.`);
  audioStore.set({ current: { cue, vars }, notice: null });

  return new Promise<void>((resolve) => {
    let done = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => { if (done) return; done = true; if (timer) clearTimeout(timer); if (active?.id === id) { active = null; audioStore.set({ speaking: 'idle' }); } resolve(); };
    const captionsOnly = (why: string | null) => {
      if (why) notices.push(why);
      audioStore.set({ speaking: 'captions', notice: notices.join(' ') || null });
      let remaining = captionMs(r.subtitle, audioStore.get().speed); let startedAt = Date.now();
      const arm = () => { startedAt = Date.now(); timer = setTimeout(finish, remaining); };
      active = { id, cancel: finish, pause: () => { if (timer) clearTimeout(timer); remaining -= Date.now() - startedAt; }, resume: arm, setRate: () => undefined };
      arm();
    };

    const useSpeechSynthesis = () => {
      const ss = synth();
      const voice = ss ? pickVoice(ss.getVoices(), info.ttsLocale) : null;
      if (!ss || !voice || typeof SpeechSynthesisUtterance === 'undefined') { captionsOnly(`No ${info.label} voice is installed on this device, so only captions are shown.`); return; }
      const u = new SpeechSynthesisUtterance(r.voice); u.voice = voice; u.lang = voice.lang; u.rate = audioStore.get().speed;
      u.onend = finish; u.onerror = finish;
      active = { id, cancel: () => { ss.cancel(); finish(); }, pause: () => ss.pause(), resume: () => ss.resume(), setRate: () => undefined };
      audioStore.set({ speaking: 'voice', notice: notices.join(' ') || null });
      ss.speak(u);
    };

    const useOnlineTTS = async (): Promise<boolean> => {
      const isTestEnv = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean((globalThis as Record<string, unknown>).__vitest__));
      if (isTestEnv || typeof Audio === 'undefined') return false;
      const ttsLang = r.lang === 'ur' || r.lang === 'ur-roman' ? 'ur' : (r.lang || 'en');
      const chunks = splitText(r.voice, 140);
      if (chunks.length === 0) return false;

      return new Promise<boolean>((ok) => {
        let chunkIdx = 0;
        let currentAudio: HTMLAudioElement | null = null;
        let started = false;

        const playNext = () => {
          if (done || id !== seq) return;
          if (chunkIdx >= chunks.length) {
            finish();
            return;
          }
          const textChunk = chunks[chunkIdx++]!;
          const localUrl = `/api/tts?q=${encodeURIComponent(textChunk)}&tl=${encodeURIComponent(ttsLang)}`;
          const directUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textChunk)}&tl=${encodeURIComponent(ttsLang)}&client=tw-ob`;

          const a = new Audio();
          if (typeof a.setAttribute === 'function') a.setAttribute('referrerpolicy', 'no-referrer');
          a.playbackRate = audioStore.get().speed;
          currentAudio = a;

          const tryPlay = (url: string, isFallback: boolean) => {
            a.src = url;
            a.onplaying = () => {
              if (!started) {
                started = true;
                audioStore.set({ speaking: 'voice', notice: notices.join(' ') || null });
                ok(true);
              }
            };
            a.onended = () => {
              playNext();
            };
            a.onerror = () => {
              if (!isFallback) {
                tryPlay(directUrl, true);
              } else {
                if (!started) ok(false);
                else finish();
              }
            };
            a.play().catch(() => {
              if (!isFallback) {
                tryPlay(directUrl, true);
              } else {
                if (!started) ok(false);
                else finish();
              }
            });
          };

          tryPlay(localUrl, false);
        };

        active = {
          id,
          cancel: () => {
            if (currentAudio) currentAudio.pause();
            finish();
          },
          pause: () => {
            if (currentAudio) currentAudio.pause();
          },
          resume: () => {
            if (currentAudio) void currentAudio.play();
          },
          setRate: (x) => {
            if (currentAudio) currentAudio.playbackRate = x;
          },
        };
        playNext();
      });
    };

    const usePreGenerated = async (): Promise<boolean> => {
      if (/\{\w+\}/.test(cue.text[r.lang]?.voiceText ?? cue.text[r.lang]?.subtitle ?? '')) return false; // filled with real values: cannot be pre-generated
      const m = await loadManifest();
      const entry = m.entries[`${r.lang}/${cue.id}`];
      if (!entry || entry.hash !== textHash(cue.text[r.lang]?.voiceText ?? cue.text[r.lang]?.subtitle ?? '')) return false;
      return new Promise<boolean>((ok) => {
        const a = new Audio(`/audio/${r.lang}/${cue.id}.mp3`); a.playbackRate = audioStore.get().speed;
        let started = false;
        a.onplaying = () => { started = true; ok(true); };
        a.onended = finish;
        a.onerror = () => { if (!started) ok(false); else finish(); };
        active = { id, cancel: () => { a.pause(); finish(); }, pause: () => a.pause(), resume: () => void a.play(), setRate: (x) => { a.playbackRate = x; } };
        audioStore.set({ speaking: 'voice', notice: notices.join(' ') || null });
        a.play().catch(() => ok(false));
      });
    };

    if (!s.narrationOn) { captionsOnly(null); return; }
    void usePreGenerated().then((ok) => {
      if (id !== seq || done) return;
      if (ok) return;

      // Check if browser SpeechSynthesis has a matching voice for this language
      const ss = synth();
      const hasVoice = ss && pickVoice(ss.getVoices(), info.ttsLocale);

      if (hasVoice) {
        useSpeechSynthesis();
      } else {
        // Device lacks native voice (e.g. Urdu on Windows). Try online TTS streaming before captions fallback
        void useOnlineTTS().then((onlineOk) => {
          if (id !== seq || done) return;
          if (!onlineOk) useSpeechSynthesis();
        });
      }
    });
  });
}

export function pause(): void { if (!active) return; active.pause(); audioStore.set({ speaking: 'paused' }); }
export function resume(): void { if (!active || audioStore.get().speaking !== 'paused') return; active.resume(); audioStore.set({ speaking: audioStore.get().narrationOn ? 'voice' : 'captions' }); }
export function replay(): Promise<void> { return last ? speak(last.cue, last.vars) : Promise.resolve(); }
/** Skip ends the current cue immediately (a lesson then moves on to the next one). */
export function skip(): void { stop(); }
export function clearSubtitle(): void { stop(); audioStore.set({ current: null, notice: null }); }

/** Speaks any raw explanatory text in the user's active language using online TTS / synthesizer. */
export async function speakText(text: string, lang?: string): Promise<void> {
  const currentLang = lang || audioStore.get().lang;
  const syntheticCue: NarrationCue = {
    id: `explain-${textHash(text)}`,
    text: {
      [currentLang]: {
        subtitle: text,
        voiceText: text,
      },
    },
    trigger: { stepIndex: 0 },
  };
  return speak(syntheticCue);
}
