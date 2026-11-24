import { describe, expect, it } from 'vitest';
import { buildPipeline } from '../../algorithms';
import { layoutLayers } from '../layout';
import { forestFromTrace } from '../forest';
import { explainDfa, explainRun } from '../explain';

describe('layout', () => {
  it('places every state once, start in the first column, deeper states further right', () => {
    const p = buildPipeline('(a|b)*abb');
    const dfa = p.dfa.result;
    const pos = layoutLayers([...dfa.states.values()], dfa.transitions, dfa.start);
    expect(pos.size).toBe(dfa.states.size);
    expect(pos.get(dfa.start)?.x).toBe(0);
    const keys = new Set([...pos.values()].map((p) => `${p.x},${p.y}`));
    expect(keys.size).toBe(pos.size); // no two states on the same spot
  });
  it('still positions states that are not yet connected to the start', () => {
    const pos = layoutLayers([{ id: 0 }, { id: 1 }], [], 5);
    expect(pos.size).toBe(2);
  });
});

describe('forest from parse trace', () => {
  it('grows node by node and ends with a single root', () => {
    const p = buildPipeline('a|b*');
    expect(forestFromTrace(p.parse.steps, 0)).toHaveLength(0);
    const full = forestFromTrace(p.parse.steps, p.parse.steps.length);
    expect(full).toHaveLength(1);
    expect(full[0]?.type).toBe('union');
    expect(full[0]?.children.map((c) => c.type)).toEqual(['symbol', 'star']);
  });
});

describe('explanations use real values from the trace', () => {
  it('mentions the real NFA state sets', () => {
    const p = buildPipeline('a*');
    const move = p.dfa.steps.find((s) => s.kind === 'move');
    expect(explainDfa(move!)).toContain(`{${(move!.payload.moved as number[]).join(', ')}}`);
    const run = buildPipeline('ab');
    expect(explainRun({ index: 0, kind: 'end', payload: { state: 1, accepted: true } }, (i) => `M${i}`)).toContain('ACCEPTED');
    expect(run.min.result.dfa.states.size).toBe(3);
  });
});
