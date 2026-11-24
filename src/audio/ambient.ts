/** Data for the original ambient loop. Pure: the Web Audio engine only plays these notes. */
export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Four slow chords (A minor 9, F major 7, C major 9, G sus2). Original progression, no melody, no vocals. */
export const CHORDS: number[][] = [
  [45, 57, 60, 64, 71], // A2 A3 C4 E4 B4
  [41, 57, 60, 65, 69], // F2 A3 C4 F4 A4
  [48, 55, 59, 64, 74], // C3 G3 B3 E4 D5
  [43, 55, 62, 67, 69], // G2 G3 D4 G4 A4
];
export const CHORD_SECONDS = 8;
export const LOOP_SECONDS = CHORDS.length * CHORD_SECONDS;

export interface NoteEvent { freq: number; start: number; dur: number }
/** Every note of one loop, relative to the loop start. Notes overlap the next chord for a soft crossfade. */
export function loopNotes(): NoteEvent[] {
  return CHORDS.flatMap((chord, c) => chord.map((m) => ({ freq: midiToHz(m), start: c * CHORD_SECONDS, dur: CHORD_SECONDS + 3 })));
}

/** Music level while narration speaks: about 30 percent of the user's volume. */
export const DUCK_FACTOR = 0.3;
export const DUCK_FADE_S = 0.35;
export const musicGain = (volume: number, musicOn: boolean, ducked: boolean) => (!musicOn ? 0 : Math.min(1, Math.max(0, volume)) * (ducked ? DUCK_FACTOR : 1));
