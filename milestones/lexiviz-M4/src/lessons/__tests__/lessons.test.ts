import { describe, expect, it } from 'vitest';
import { LESSONS, allStages, resultCue } from '../lessons';
import { runStage, stageTimeline } from '../run';
import { LANGUAGES } from '../../audio/languages';
import { fillTemplate, placeholdersOf, resolveCue } from '../../audio/narration';

const cues = allStages().flatMap((s) => s.cues);
const ph = (c: (typeof cues)[number], lang: string) => placeholdersOf(c.text[lang]!.subtitle).sort();

describe('lesson data completeness', () => {
  it('has the four required first lessons', () => {
    const ids = LESSONS.map((l) => l.id);
    for (const id of ['regex-to-nfa', 'nfa-to-dfa', 'dfa-acceptance', 'lexical-analysis']) expect(ids).toContain(id);
  });
  it('every cue has English text, and cue ids are unique', () => {
    for (const c of cues) expect(c.text.en?.subtitle.length, c.id).toBeGreaterThan(0);
    expect(new Set(cues.map((c) => c.id)).size).toBe(cues.length);
  });
  it('every registered language covers every cue, with the same placeholders as English', () => {
    for (const l of LANGUAGES) for (const c of cues) {
      expect(c.text[l.code], `${l.code}/${c.id}`).toBeDefined();
      expect(ph(c, l.code), `${l.code}/${c.id}`).toEqual(ph(c, 'en'));
    }
  });
  it('Roman Urdu keeps Latin subtitles and carries Urdu-script voice text', () => {
    for (const c of cues) {
      const t = c.text['ur-roman']!;
      expect(t.subtitle).not.toMatch(/[\u0600-\u06FF]/);
      expect(t.voiceText).toMatch(/[\u0600-\u06FF]/);
    }
  });
  it('technical terms are never translated', () => {
    for (const c of cues) for (const l of LANGUAGES) {
      const all = Object.values(c.text[l.code]!).join(' ');
      if (/NFA|DFA/.test(c.text.en!.subtitle)) expect(all, `${l.code}/${c.id}`).toMatch(/NFA|DFA/);
    }
  });
  it('registry entries carry everything the UI needs', () => {
    for (const l of LANGUAGES) { expect(l.dir).toMatch(/^(ltr|rtl)$/); expect(l.ttsLocale).toMatch(/^[a-z]{2}-[A-Z]{2}$/); expect(l.font.length).toBeGreaterThan(0); expect(['original', 'ai-translated', 'human-reviewed']).toContain(l.review); }
    expect(LANGUAGES.find((l) => l.code === 'ur')?.dir).toBe('rtl');
    expect(LANGUAGES.filter((l) => l.code !== 'en').every((l) => l.review === 'ai-translated')).toBe(true);
  });
  it('a language without text falls back to English', () => {
    const c = cues[0]!; const r = resolveCue(c, 'fr', {});
    expect(r.fellBack).toBe(true); expect(r.lang).toBe('en'); expect(r.subtitle).toBe(c.text.en!.subtitle);
  });
});

describe('lessons run the real algorithms', () => {
  it('every cue lands on a real step of its trace (nothing unmatched)', () => {
    for (const st of allStages()) { const t = stageTimeline(st, runStage(st)); expect(t.unmatched, st.id).toEqual([]); expect(t.items.length).toBe(st.cues.length); }
  });
  it('every placeholder is filled from the real result (no braces left, in every language)', () => {
    for (const st of allStages()) { const run = runStage(st); for (const c of st.cues) for (const l of LANGUAGES) expect(fillTemplate(c.text[l.code]!.subtitle, run.vars), `${l.code}/${c.id}`).not.toMatch(/\{\w+\}/); }
  });
  it('result cues state the true numbers', () => {
    const s = (id: string) => runStage(allStages().find((x) => x.id === id)!);
    expect(s('lexer').vars).toEqual({ tokenCount: 5, errorCount: 0 }); // int total = 25;
    expect(resolveCue(resultCue('lexer')!, 'en', s('lexer').vars).subtitle).toBe('The lexer completed scanning: found 5 tokens and 0 errors in the source.');
    expect(s('regex-nfa').vars).toEqual({ pattern: 'a|b', stateCount: 6, edgeCount: 6 }); // Thompson: a|b has 6 states
    const m = s('minimize').vars; expect(m).toEqual({ before: 5, after: 4 }); // textbook example: subset construction gives 5 states, the minimal DFA has 4
    expect(s('acceptance-accepted').vars).toEqual({ input: 'aabb' });
    expect(s('parser').vars).toEqual({ tokenCount: 6 });
  });
  it('cues are ordered along the trace and the result cue comes last', () => {
    for (const st of allStages()) { const t = stageTimeline(st, runStage(st)).items; const last = t[t.length - 1]!; if (st.cues.some((c) => 'stage' in c.trigger)) expect('stage' in last.cue.trigger).toBe(true); for (let i = 1; i < t.length; i++) expect(t[i]!.shown).toBeGreaterThanOrEqual(t[i - 1]!.shown); }
  });
  it('the accepted and rejected demo strings really are accepted and rejected', () => {
    const end = (id: string) => runStage(allStages().find((x) => x.id === id)!).steps.at(-1)!.payload.accepted;
    expect(end('acceptance-accepted')).toBe(true); expect(end('acceptance-rejected')).toBe(false);
  });
});
