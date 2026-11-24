import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';
import { TopBar } from '../../components/TopBar';
import { SubtitleBar } from '../../components/SubtitleBar';
import { WelcomeOverlay } from '../../components/WelcomeOverlay';
import { audioStore, sanitize, DEFAULT_SETTINGS } from '../audioStore';
import { CHORDS, DUCK_FACTOR, LOOP_SECONDS, loopNotes, midiToHz, musicGain } from '../ambient';
import { MusicEngine } from '../music';
import { captionMs, fillTemplate, subtitleLines, textHash } from '../narration';
import { _resetManifestForTests, pause, pickVoice, replay, resume, speak, stop } from '../narrator';
import { resultCue, findStage } from '../../lessons/lessons';
import { fixedCues, planJobs, textHash as scriptHash } from '../../../scripts/narration-lib.mjs';
import lessonsJson from '../../lessons/lessons.json';
import langsJson from '../languages.json';

const rn = findStage('regex-nfa')!.cues;
const cue = rn[0]!;

beforeEach(() => { localStorage.clear(); audioStore.reset(); _resetManifestForTests(); });
afterEach(() => { stop(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('template filling and subtitles', () => {
  it('fills placeholders with real values and leaves unknown ones visible', () => {
    expect(fillTemplate('{a} has {n} states', { a: 'X', n: 5 })).toBe('X has 5 states');
    expect(fillTemplate('{a} and {missing}', { a: 1 })).toBe('1 and {missing}');
  });
  it('shows one line, or two when a second language is chosen; never the same language twice', () => {
    expect(subtitleLines(cue, {}, 'en', '')).toHaveLength(1);
    const two = subtitleLines(cue, {}, 'en', 'ur');
    expect(two).toHaveLength(2); expect(two[1]!.dir).toBe('rtl');
    expect(subtitleLines(cue, {}, 'en', 'en')).toHaveLength(1);
    expect(subtitleLines(cue, {}, 'en', 'fr')).toHaveLength(1); // unknown second language is skipped
  });
  it('caption time grows with text length and shrinks with speed', () => {
    expect(captionMs('x'.repeat(100), 1)).toBeGreaterThan(captionMs('x'.repeat(40), 1));
    expect(captionMs('x'.repeat(100), 1.5)).toBeLessThan(captionMs('x'.repeat(100), 1));
  });
});

describe('music: ducking and generated loop', () => {
  it('plays the speech-time level at about 30 percent and silences when off', () => {
    expect(DUCK_FACTOR).toBe(0.3);
    expect(musicGain(0.5, true, false)).toBe(0.5);
    expect(musicGain(0.5, true, true)).toBeCloseTo(0.15);
    expect(musicGain(0.5, false, true)).toBe(0);
    expect(musicGain(7, true, false)).toBe(1);
  });
  it('the loop is a calm chord progression: no melody notes, all in a soft register, notes within the loop', () => {
    expect(midiToHz(69)).toBe(440); expect(midiToHz(81)).toBeCloseTo(880);
    expect(CHORDS).toHaveLength(4);
    for (const c of CHORDS.flat()) { expect(c).toBeGreaterThanOrEqual(36); expect(c).toBeLessThanOrEqual(80); }
    const notes = loopNotes(); expect(notes).toHaveLength(CHORDS.flat().length);
    for (const n of notes) { expect(n.start).toBeGreaterThanOrEqual(0); expect(n.start).toBeLessThan(LOOP_SECONDS); }
  });
  function fakeCtx() {
    const gains: { ramps: [number, number][]; gain: { value: number } }[] = []; let osc = 0;
    const param = (g: { ramps: [number, number][] }) => ({ value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime: (v: number, t: number) => { g.ramps.push([v, t]); } });
    const ctx = {
      currentTime: 10, destination: {}, resume: async () => undefined, suspend: async () => undefined, close: async () => undefined,
      createGain() { const g = { ramps: [] as [number, number][], gain: {} as never, connect() {} }; g.gain = param(g) as never; gains.push(g as never); return g; },
      createBiquadFilter: () => ({ type: '', frequency: { value: 0 }, connect() {} }),
      createDelay: () => ({ delayTime: { value: 0 }, connect() {} }),
      createOscillator() { osc++; return { type: '', frequency: { value: 0 }, detune: { value: 0 }, connect() {}, start() {}, stop() {} }; },
    };
    return { ctx: ctx as unknown as AudioContext, gains, oscCount: () => osc };
  }
  it('starts the synthesized loop when there is no music file, and fades to the requested level', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html>', { headers: { 'content-type': 'text/html' } })); // dev servers answer 200 with HTML
    const f = fakeCtx(); const e = new MusicEngine(() => f.ctx);
    expect(await e.start()).toBe('synth');
    expect(f.oscCount()).toBe(loopNotes().length * 2);
    e.setLevel(0.06);
    const master = f.gains[0]!; const last = master.ramps.at(-1)!;
    expect(last[0]).toBe(0.06); expect(last[1]).toBeGreaterThan(10);
    e.stop();
  });
  it('reports "none" instead of throwing when audio cannot start', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
    expect(await new MusicEngine(() => { throw new Error('no audio'); }).start()).toBe('none');
  });
});

describe('settings', () => {
  it('rejects bad stored data and clamps numbers', () => {
    expect(sanitize(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitize({ volume: 5, speed: 9, lang: 'klingon', lang2: 'ur', musicOn: 'yes' })).toEqual({ ...DEFAULT_SETTINGS, volume: 1, speed: 1.5, lang2: 'ur' });
    expect(DEFAULT_SETTINGS.volume).toBeLessThanOrEqual(0.3); // low default volume
  });
  it('persists to localStorage', () => {
    audioStore.set({ volume: 0.7, lang: 'ur' });
    expect(JSON.parse(localStorage.getItem('lexiviz.audio')!)).toMatchObject({ volume: 0.7, lang: 'ur' });
    audioStore.set({ entered: true }); // runtime state is not persisted
    expect(JSON.parse(localStorage.getItem('lexiviz.audio')!)).not.toHaveProperty('entered');
  });
});

function fakeSpeech(voices: { lang: string }[]) {
  const utterances: { text: string; rate: number; onend?: () => void }[] = [];
  const ss = { getVoices: () => voices, speak: (u: never) => { utterances.push(u); }, cancel: vi.fn(() => { utterances.splice(0).forEach((u) => u.onend?.()); }), pause: vi.fn(), resume: vi.fn() };
  vi.stubGlobal('speechSynthesis', ss);
  vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; rate = 1; voice = null; lang = ''; onend?: () => void; onerror?: () => void; constructor(t: string) { this.text = t; } });
  vi.stubGlobal('fetch', async () => { throw new Error('no files'); });
  return { ss, utterances };
}

describe('narration engine', () => {
  it('speaks with a browser voice, at the chosen speed, and ducks via the speaking state', async () => {
    const { utterances } = fakeSpeech([{ lang: 'en-US' }]);
    audioStore.set({ speed: 1.25 });
    const p = speak(cue); await vi.waitFor(() => expect(utterances).toHaveLength(1));
    expect(utterances[0]!.text).toBe(cue.text.en!.subtitle); expect(utterances[0]!.rate).toBe(1.25);
    expect(audioStore.get().speaking).toBe('voice');
    utterances[0]!.onend?.(); await p; expect(audioStore.get().speaking).toBe('idle');
  });
  it('never overlaps two voices: a new cue replaces the current one', async () => {
    const { ss, utterances } = fakeSpeech([{ lang: 'en-US' }]);
    const first = speak(cue); await vi.waitFor(() => expect(utterances).toHaveLength(1));
    const second = speak(rn[1]!); await first; // first is cancelled and settles
    await vi.waitFor(() => expect(utterances).toHaveLength(1));
    expect(ss.cancel).toHaveBeenCalled();
    expect(utterances[0]!.text).toBe(rn[1]!.text.en!.subtitle);
    expect(audioStore.get().current?.cue.id).toBe(rn[1]!.id);
    utterances[0]!.onend?.(); await second;
  });
  it('speaks the Urdu-script voiceText for Roman Urdu while showing Latin subtitles', async () => {
    const { utterances } = fakeSpeech([{ lang: 'ur-PK' }]);
    audioStore.set({ lang: 'ur-roman' });
    const p = speak(cue); await vi.waitFor(() => expect(utterances).toHaveLength(1));
    expect(utterances[0]!.text).toMatch(/[\u0600-\u06FF]/);
    expect(subtitleLines(cue, {}, 'ur-roman', '')[0]!.text).not.toMatch(/[\u0600-\u06FF]/);
    utterances[0]!.onend?.(); await p;
  });
  it('falls back to captions with a clear notice when the device has no voice for the language', async () => {
    vi.useFakeTimers(); fakeSpeech([{ lang: 'en-US' }]);
    audioStore.set({ lang: 'ur' });
    const p = speak(cue); await vi.advanceTimersByTimeAsync(10);
    expect(audioStore.get().speaking).toBe('captions');
    expect(audioStore.get().notice).toMatch(/No .*voice is installed.*captions/);
    await vi.advanceTimersByTimeAsync(10000); await p; expect(audioStore.get().speaking).toBe('idle');
  });
  it('with narration off it shows captions only and never touches speech synthesis', async () => {
    vi.useFakeTimers(); const { ss } = fakeSpeech([{ lang: 'en-US' }]);
    audioStore.set({ narrationOn: false });
    const p = speak(cue); await vi.advanceTimersByTimeAsync(10000); await p;
    expect(ss.cancel).toHaveBeenCalledTimes(1); // only the stop() at the start of speak()
    expect(audioStore.get().current?.cue.id).toBe(cue.id);
  });
  it('fills placeholders with the real values when speaking a result', async () => {
    const { utterances } = fakeSpeech([{ lang: 'en-US' }]);
    const p = speak(resultCue('lexer')!, { tokenCount: 7, errorCount: 2 }); await vi.waitFor(() => expect(utterances).toHaveLength(1));
    expect(utterances[0]!.text).toBe('The lexer completed scanning: found 7 tokens and 2 errors in the source.');
    utterances[0]!.onend?.(); await p;
  });
  it('pause, resume and replay work', async () => {
    const { ss, utterances } = fakeSpeech([{ lang: 'en-US' }]);
    void speak(cue); await vi.waitFor(() => expect(utterances).toHaveLength(1));
    pause(); expect(ss.pause).toHaveBeenCalled(); expect(audioStore.get().speaking).toBe('paused');
    resume(); expect(ss.resume).toHaveBeenCalled(); expect(audioStore.get().speaking).toBe('voice');
    void replay(); await vi.waitFor(() => expect(utterances.length).toBeGreaterThan(0)); stop();
  });
  it('picks an exact locale match before a same-language match', () => {
    const v = [{ lang: 'en-GB' }, { lang: 'en-US' }] as SpeechSynthesisVoice[];
    expect(pickVoice(v, 'en-US')?.lang).toBe('en-US'); expect(pickVoice(v, 'fr-FR')).toBeNull(); expect(pickVoice([{ lang: 'ur_PK' }] as SpeechSynthesisVoice[], 'ur-PK')).not.toBeNull();
  });
});

describe('UI', () => {
  it('switching language changes the subtitles, direction and shows the AI-translated badge', async () => {
    audioStore.set({ narrationOn: false });
    render(<><TopBar /><SubtitleBar /></>);
    await act(async () => { void speak(cue); });
    expect(screen.getByText(cue.text.en!.subtitle)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Subtitle and voice language'), { target: { value: 'ur' } });
    const line = screen.getByText(cue.text.ur!.subtitle, { exact: false });
    expect(line).toHaveAttribute('dir', 'rtl'); expect(screen.queryByText(cue.text.en!.subtitle)).toBeNull();
    expect(screen.getByText(/AI-translated/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Second subtitle language'), { target: { value: 'en' } });
    expect(screen.getByText(cue.text.en!.subtitle)).toBeInTheDocument();
    stop();
  });
  it('the welcome overlay gates sound: Enter without sound turns music and voice off', async () => {
    render(<WelcomeOverlay />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByText('Enter without sound')); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(audioStore.get()).toMatchObject({ entered: true, musicOn: false, narrationOn: false });
  });
  it('music mute and volume controls update the persisted settings', () => {
    render(<TopBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Mute music' }));
    expect(audioStore.get().musicOn).toBe(false);
    fireEvent.change(screen.getByLabelText('Music volume'), { target: { value: '55' } });
    expect(audioStore.get().volume).toBe(0.55);
  });
  it('the Lexer Lab speaks the real result of the user\'s own source after Enter', async () => {
    fakeSpeech([]); // no voices: captions appear
    audioStore.reset({ entered: true });
    render(<MemoryRouter initialEntries={['/lexer']}><App /></MemoryRouter>);
    expect(await screen.findByText('The lexer completed scanning: found 5 tokens and 0 errors in the source.')).toBeInTheDocument();
    stop();
  });
  it('labs stay silent before the user has entered', () => {
    fakeSpeech([]);
    render(<MemoryRouter initialEntries={['/lexer']}><App /></MemoryRouter>);
    expect(screen.queryByText(/The lexer found/)).toBeNull();
  });
});

describe('generation script logic', () => {
  const settings = { provider: 'openai', voice: 'alloy' };
  const langs = langsJson.languages;
  it('uses the same hash as the app', () => { for (const s of ['abc', 'اردو', '']) expect(scriptHash(s)).toBe(textHash(s)); });
  it('only pre-generates fixed cues, never cues with placeholders', () => {
    const fixed = fixedCues(lessonsJson.lessons);
    expect(fixed.length).toBeGreaterThan(0);
    for (const c of fixed) for (const t of Object.values(c.text) as { subtitle: string }[]) expect(t.subtitle).not.toMatch(/\{\w+\}/);
    expect(planJobs(lessonsJson.lessons, langs, { entries: {} }, settings).jobs).toHaveLength(fixed.length * langs.length);
  });
  it('regenerates only changed text, and everything when the voice changes', () => {
    const all = planJobs(lessonsJson.lessons, langs, { entries: {} }, settings).jobs;
    const manifest = { entries: Object.fromEntries(all.map((j) => [j.key, { hash: j.hash, ...settings }])) };
    expect(planJobs(lessonsJson.lessons, langs, manifest, settings)).toMatchObject({ jobs: [], upToDate: all.length });
    manifest.entries[all[0]!.key]!.hash = 'deadbeef';
    expect(planJobs(lessonsJson.lessons, langs, manifest, settings).jobs.map((j) => j.key)).toEqual([all[0]!.key]);
    expect(planJobs(lessonsJson.lessons, langs, manifest, { ...settings, voice: 'nova' }).jobs).toHaveLength(all.length);
  });
});
