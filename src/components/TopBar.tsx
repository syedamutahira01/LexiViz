import { Mic, MicOff, Palette, Volume2, VolumeX } from 'lucide-react';
import { SPEEDS, audioStore, useAudio } from '../audio/audioStore';
import { LANGUAGES } from '../audio/languages';
import { stop } from '../audio/narrator';
import { themeStore, useTheme, type ThemeMode } from '../theme/themeStore';

export function TopBar() {
  const a = useAudio();
  const theme = useTheme();
  const set = audioStore.set;
  return (
    <div className="topbar" role="toolbar" aria-label="Audio, theme and language">
      <button type="button" aria-pressed={a.musicOn} aria-label={a.musicOn ? 'Mute music' : 'Unmute music'} onClick={() => set({ musicOn: !a.musicOn })}>
        {a.musicOn ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />} Music
      </button>
      <label className="inline">Volume
        <input type="range" min={0} max={100} value={Math.round(a.volume * 100)} aria-label="Music volume" onChange={(e) => set({ volume: Number(e.target.value) / 100 })} />
      </label>
      <button type="button" aria-pressed={a.narrationOn} onClick={() => { if (a.narrationOn) stop(); set({ narrationOn: !a.narrationOn }); }}>
        {a.narrationOn ? <Mic size={16} aria-hidden="true" /> : <MicOff size={16} aria-hidden="true" />} Narration
      </button>
      <label className="inline">Language
        <select value={a.lang} onChange={(e) => set({ lang: e.target.value, notice: null })} aria-label="Subtitle and voice language">
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </label>
      <label className="inline">Second subtitles
        <select value={a.lang2} onChange={(e) => set({ lang2: e.target.value })} aria-label="Second subtitle language">
          <option value="">None</option>
          {LANGUAGES.filter((l) => l.code !== a.lang).map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </label>
      <label className="inline">Speed
        <select value={a.speed} onChange={(e) => set({ speed: Number(e.target.value) })} aria-label="Narration speed">
          {SPEEDS.map((s) => <option key={s} value={s}>{s}x</option>)}
        </select>
      </label>
      <label className="inline">
        <Palette size={15} aria-hidden="true" /> Theme
        <select value={theme} onChange={(e) => themeStore.set(e.target.value as ThemeMode)} aria-label="Color theme">
          <option value="ice-cream">🍦 Ice Cream (Beige)</option>
          <option value="chocolate">🍫 Chocolate Brown</option>
        </select>
      </label>
    </div>
  );
}
