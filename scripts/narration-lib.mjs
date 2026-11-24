// Pure helpers for the narration generator (no network, no file writes), so they can be unit tested.

/** 32-bit FNV-1a. Must match textHash() in src/audio/narration.ts. */
export function textHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** Minimal .env parser: KEY=value lines, # comments. Never logs values. */
export function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

/** Fixed cues only: a cue with {placeholders} is filled at run time and spoken by the browser instead. */
export function fixedCues(lessons) {
  return lessons.flatMap((l) => l.stages.flatMap((s) => s.cues))
    .filter((c) => !Object.values(c.text).some((t) => /\{\w+\}/.test(t.voiceText ?? t.subtitle)));
}

/** Splits text into natural sentence or phrase chunks within maxLen characters for TTS APIs. */
export function splitText(text, maxLen = 140) {
  if (text.length <= maxLen) return [text];
  const parts = [];
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

/** What needs generating: every (language, cue) whose text hash or provider/voice differs from the manifest. */
export function planJobs(lessons, languages, manifest, settings) {
  const jobs = []; let upToDate = 0;
  for (const cue of fixedCues(lessons)) {
    for (const lang of languages) {
      const t = cue.text[lang.code]; if (!t) continue;
      const text = t.voiceText ?? t.subtitle;
      const key = `${lang.code}/${cue.id}`; const hash = textHash(text);
      const e = manifest.entries[key];
      if (e && e.hash === hash && e.provider === settings.provider && e.voice === settings.voice) upToDate++;
      else jobs.push({ key, lang, cueId: cue.id, text, hash });
    }
  }
  return { jobs, upToDate };
}

/** Providers share one interface: synth({ text, lang, voice, model, apiKey }) resolves to an mp3 Buffer. */
export const providers = {
  openai: {
    name: 'openai',
    async synth({ text, voice, model, apiKey }) {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || 'gpt-4o-mini-tts', voice: voice || 'alloy', input: text, response_format: 'mp3' }),
      });
      if (!res.ok) throw new Error(`openai tts failed: HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
  },
  google: {
    name: 'google',
    async synth({ text, lang }) {
      const langCode = lang?.code === 'ur' || lang?.code === 'ur-roman' ? 'ur' : (lang?.code || 'en');
      const chunks = splitText(text, 140);
      const buffers = [];
      for (const chunk of chunks) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${langCode}&client=tw-ob`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
        if (!res.ok) throw new Error(`google tts failed: HTTP ${res.status}`);
        buffers.push(Buffer.from(await res.arrayBuffer()));
        await new Promise((r) => setTimeout(r, 60));
      }
      return Buffer.concat(buffers);
    },
  },
};
