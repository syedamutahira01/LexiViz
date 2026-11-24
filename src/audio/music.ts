/** Music engine. Plays public/audio/music/loop.mp3 if it exists, otherwise a generated ambient loop (Web Audio). */
import { DUCK_FADE_S, LOOP_SECONDS, loopNotes } from './ambient';

export const MUSIC_FILE = '/audio/music/loop.mp3';
type CtxFactory = () => AudioContext;

export class MusicEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private audio: HTMLAudioElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextLoop = 0;
  private target = 0;
  source: 'none' | 'file' | 'synth' = 'none';
  constructor(private makeCtx: CtxFactory = () => new AudioContext()) {}

  /** Must be called from a user gesture (the Enter button). */
  async start(): Promise<'file' | 'synth' | 'none'> {
    if (this.source !== 'none') return this.source;
    if (await fileExists()) {
      try {
        const a = new Audio(MUSIC_FILE); a.loop = true; a.volume = this.target;
        await a.play(); this.audio = a; this.source = 'file'; return 'file';
      } catch { /* fall through to the synthesized loop */ }
    }
    try {
      this.ctx = this.makeCtx();
      this.master = this.ctx.createGain(); this.master.gain.value = this.target;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
      const delay = this.ctx.createDelay(1); delay.delayTime.value = 0.45;
      const fb = this.ctx.createGain(); fb.gain.value = 0.35;
      lp.connect(this.master); lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.input = lp; this.nextLoop = this.ctx.currentTime + 0.1; this.schedule();
      await this.ctx.resume(); this.source = 'synth'; return 'synth';
    } catch { this.source = 'none'; return 'none'; }
  }
  private input: AudioNode | null = null;

  private schedule = () => {
    const ctx = this.ctx; if (!ctx || !this.input) return;
    for (const n of loopNotes()) {
      for (const detune of [-4, 4]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = n.freq; o.detune.value = detune;
        const g = ctx.createGain(); const t0 = this.nextLoop + n.start;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.045, t0 + 2.5); g.gain.linearRampToValueAtTime(0, t0 + n.dur);
        o.connect(g); g.connect(this.input); o.start(t0); o.stop(t0 + n.dur + 0.1);
      }
    }
    this.nextLoop += LOOP_SECONDS;
    this.timer = setTimeout(this.schedule, Math.max(1000, (this.nextLoop - ctx.currentTime - 6) * 1000));
  };

  /** Fades to the target level (already ducked or muted by the caller). */
  setLevel(level: number): void {
    this.target = level;
    if (this.audio) this.audio.volume = level;
    if (this.ctx && this.master) {
      const t = this.ctx.currentTime; const g = this.master.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(level, t + DUCK_FADE_S);
    }
  }
  /** Pauses while the tab is hidden. */
  setSuspended(s: boolean): void {
    if (this.audio) { if (s) this.audio.pause(); else void this.audio.play().catch(() => undefined); }
    if (this.ctx) void (s ? this.ctx.suspend() : this.ctx.resume()).catch(() => undefined);
  }
  stop(): void { if (this.timer) clearTimeout(this.timer); this.audio?.pause(); void this.ctx?.close().catch(() => undefined); this.ctx = null; this.master = null; this.audio = null; this.source = 'none'; }
}

async function fileExists(): Promise<boolean> {
  try {
    const r = await fetch(MUSIC_FILE, { method: 'HEAD' });
    return r.ok && (r.headers.get('content-type') ?? '').startsWith('audio');
  } catch { return false; }
}
