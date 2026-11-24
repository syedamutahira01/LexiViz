/** Runs the REAL algorithms on a stage's demo input and returns the trace plus the values cues may mention. */
import { buildPipeline, lex, parseProgram, parseRegex, regexToNfa, runDfa, type LexResult, type Nfa, type Dfa, type StepEvent, type Token } from '../algorithms';
import type { LessonStage, NarrationCue, Vars } from './types';

export const regexNfaVars = (pattern: string, nfa: Nfa): Vars => ({ pattern, stateCount: nfa.states.size, edgeCount: nfa.transitions.length });
export const nfaDfaVars = (nfa: Nfa, dfa: Dfa): Vars => ({ nfaCount: nfa.states.size, dfaCount: dfa.states.size });
export const minimizeVars = (dfa: Dfa, min: Dfa): Vars => ({ before: dfa.states.size, after: min.states.size });
export const acceptanceVars = (input: string): Vars => ({ input: input === '' ? 'ε' : input });
export const lexerVars = (r: LexResult): Vars => ({ tokenCount: r.tokens.length, errorCount: r.errors.length });
export const parserVars = (tokens: Token[]): Vars => ({ tokenCount: tokens.length });

export interface StageRun { steps: StepEvent[]; vars: Vars }

export function runStage(stage: LessonStage): StageRun {
  const demo = stage.demoInput ?? '';
  switch (stage.algorithm) {
    case 'regexToNfa': { const t = regexToNfa(parseRegex(demo).result); return { steps: t.steps, vars: regexNfaVars(demo, t.result) }; }
    case 'nfaToDfa': { const p = buildPipeline(demo); return { steps: p.dfa.steps, vars: nfaDfaVars(p.nfa.result, p.dfa.result) }; }
    case 'minimize': { const p = buildPipeline(demo); return { steps: p.min.steps, vars: minimizeVars(p.dfa.result, p.min.result.dfa) }; }
    case 'acceptance': {
      const [pattern = '', input = ''] = demo.split(' ');
      const p = buildPipeline(pattern); const t = runDfa(p.min.result.dfa, input);
      return { steps: t.steps, vars: acceptanceVars(input) };
    }
    case 'lexer': { const t = lex(demo); return { steps: t.steps, vars: lexerVars(t.result) }; }
    case 'parser': { const l = lex(demo).result; const t = parseProgram(l.tokens, l.end); return { steps: t.steps, vars: parserVars(l.tokens) }; }
  }
}

export interface TimelineItem { stageId: string; cue: NarrationCue; /** trace steps applied when the cue plays */ shown: number; vars: Vars }

/** Places each cue on the real trace. Cues whose trigger never occurs are reported, not silently dropped. */
export function stageTimeline(stage: LessonStage, run: StageRun): { items: TimelineItem[]; unmatched: string[] } {
  const items: (TimelineItem & { at: number })[] = []; const unmatched: string[] = [];
  for (const cue of stage.cues) {
    let at = -1;
    if ('stepKind' in cue.trigger) at = run.steps.findIndex((s) => s.kind === (cue.trigger as { stepKind: string }).stepKind);
    else if ('stepIndex' in cue.trigger) at = cue.trigger.stepIndex < run.steps.length ? cue.trigger.stepIndex : -1;
    else at = run.steps.length;
    if (at < 0) { unmatched.push(cue.id); continue; }
    items.push({ stageId: stage.id, cue, at, shown: Math.min(run.steps.length, at + 1), vars: run.vars });
  }
  items.sort((a, b) => a.at - b.at);
  return { items: items.map(({ at: _at, ...rest }) => rest), unmatched };
}
