export type LangCode = string;
export interface LocalizedText { subtitle: string; voiceText?: string }
export type CueTrigger = { stepKind: string } | { stepIndex: number } | { stage: 'resultReady' };
export interface NarrationCue {
  id: string;
  trigger: CueTrigger;
  /** Placeholders such as {stateCount} are filled from the real algorithm result. */
  text: Record<LangCode, LocalizedText>;
  highlight?: { targetId: string; effect: 'pulse' | 'glow' | 'dim' };
}
export type AlgorithmId = 'regexToNfa' | 'nfaToDfa' | 'minimize' | 'acceptance' | 'lexer' | 'parser';
export interface LessonStage { id: string; algorithm: AlgorithmId; demoInput?: string; cues: NarrationCue[] }
export interface Lesson { id: string; title: string; stages: LessonStage[] }
export type Vars = Record<string, string | number>;
