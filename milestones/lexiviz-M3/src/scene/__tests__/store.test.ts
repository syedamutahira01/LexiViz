import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSceneUi, resetSceneUi, setHovered, setSelected, subscribeSceneUi } from '../sceneStore';
import { _resetWebglCacheForTests, currentUserOff, detectWebgl, markSceneFailed, readUserOff, setUserOff } from '../sceneSettings';
import { PHASES } from '../../data/phases';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); resetSceneUi(); _resetWebglCacheForTests(); localStorage.clear(); });

describe('scene store', () => {
  it('holds one selection, notifies subscribers only on real changes, and can be reset', () => {
    const fn = vi.fn();
    const off = subscribeSceneUi(fn);
    setSelected('syntax'); setSelected('syntax');
    expect(getSceneUi().selected).toBe('syntax');
    expect(fn).toHaveBeenCalledTimes(1);
    setSelected('lexical');
    setHovered('codegen');
    expect(getSceneUi()).toEqual({ selected: 'lexical', hovered: 'codegen' });
    off(); setSelected(null);
    expect(fn).toHaveBeenCalledTimes(3);
    resetSceneUi();
    expect(getSceneUi()).toEqual({ selected: null, hovered: null });
  });
});

describe('scene settings', () => {
  it('persists the 3D toggle', () => {
    expect(readUserOff()).toBe(false);
    setUserOff(true);
    expect(readUserOff()).toBe(true);
    expect(currentUserOff()).toBe(true);
    setUserOff(false);
    expect(readUserOff()).toBe(false);
    expect(currentUserOff()).toBe(false);
  });
  it('still works for the session when storage is blocked, and never throws', () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
    expect(readUserOff()).toBe(false);
    expect(() => setUserOff(true)).not.toThrow();
    expect(readUserOff()).toBe(false); // nothing could be stored
    expect(currentUserOff()).toBe(true); // but this session respects the choice
  });
  it('detects missing WebGL without throwing', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => { throw new Error('no gl'); });
    expect(detectWebgl()).toBe(false);
    _resetWebglCacheForTests();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({}) as never);
    expect(detectWebgl()).toBe(true);
  });
  it('a runtime failure is remembered', () => {
    expect(() => markSceneFailed()).not.toThrow();
  });
});

describe('phase data', () => {
  it('has six phases in compiler order, each fully described', () => {
    expect(PHASES.map((p) => p.id)).toEqual(['lexical', 'syntax', 'semantic', 'intermediate', 'optimization', 'codegen']);
    for (const p of PHASES) for (const k of ['what', 'why', 'input', 'output', 'how'] as const) expect(p[k].length).toBeGreaterThan(10);
  });
  it('only the phases LexiViz implements link to a lab', () => {
    expect(Object.fromEntries(PHASES.map((p) => [p.id, p.lab]))).toEqual({ lexical: '/lexer', syntax: '/parser', semantic: null, intermediate: null, optimization: null, codegen: null });
  });
});
