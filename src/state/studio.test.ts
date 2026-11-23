import { describe, it, expect } from 'vitest';
import { initialState, studioReducer, costOf, canGenerate, generateBlockReason } from './studio';

const withPrompt = (p = 'a red fox in snow') => studioReducer(initialState(), { type: 'setPrompt', prompt: p });

describe('studio credits & generate', () => {
  it('starts with 20 credits and no sessions beyond seeds', () => {
    const s = initialState();
    expect(s.credits).toBe(20);
    expect(s.maxCredits).toBe(20);
  });

  it('cost equals image count, doubled when burst is on', () => {
    let s = withPrompt();
    expect(costOf(s)).toBe(1);
    s = studioReducer(s, { type: 'setCount', count: 3 });
    expect(costOf(s)).toBe(3);
    s = studioReducer(s, { type: 'toggleBurst' });
    expect(costOf(s)).toBe(6);
  });

  it('clamps count to 1..4', () => {
    let s = studioReducer(initialState(), { type: 'setCount', count: 9 });
    expect(s.count).toBe(4);
    s = studioReducer(s, { type: 'setCount', count: 0 });
    expect(s.count).toBe(1);
  });

  it('cannot generate with an empty or whitespace prompt', () => {
    const s = studioReducer(initialState(), { type: 'setPrompt', prompt: '   ' });
    expect(canGenerate(s)).toBe(false);
    expect(generateBlockReason(s)).toMatch(/prompt/i);
    const after = studioReducer(s, { type: 'generate', id: 'x', now: 1 });
    expect(after).toBe(s);
  });

  it('generate deducts credits and prepends a loading session', () => {
    const s = studioReducer(withPrompt(), { type: 'setCount', count: 2 });
    const before = s.sessions.length;
    const after = studioReducer(s, { type: 'generate', id: 'g1', now: 100 });
    expect(after.credits).toBe(18);
    expect(after.sessions).toHaveLength(before + 1);
    expect(after.sessions[0]).toMatchObject({ id: 'g1', status: 'loading', prompt: 'a red fox in snow', count: 2, styleId: s.styleId });
  });

  it('cannot generate when cost exceeds remaining credits', () => {
    let s = withPrompt();
    s = { ...s, credits: 1 };
    s = studioReducer(s, { type: 'setCount', count: 2 });
    expect(canGenerate(s)).toBe(false);
    expect(generateBlockReason(s)).toMatch(/credit/i);
    expect(studioReducer(s, { type: 'generate', id: 'z', now: 1 })).toBe(s);
  });

  it('cannot generate at 0 credits', () => {
    const s = { ...withPrompt(), credits: 0 };
    expect(canGenerate(s)).toBe(false);
  });

  it('completeSession flips loading to done and ignores unknown ids', () => {
    const s = studioReducer(withPrompt(), { type: 'generate', id: 'g1', now: 1 });
    const done = studioReducer(s, { type: 'completeSession', id: 'g1' });
    expect(done.sessions[0].status).toBe('done');
    expect(studioReducer(done, { type: 'completeSession', id: 'nope' })).toEqual(done);
  });

  it('setStyle only accepts known style ids', () => {
    const s = studioReducer(initialState(), { type: 'setStyle', styleId: '8-bit-nostalgia' });
    expect(s.styleId).toBe('8-bit-nostalgia');
    expect(studioReducer(s, { type: 'setStyle', styleId: 'bogus' }).styleId).toBe('8-bit-nostalgia');
  });

  it('toggles burst and switches mode', () => {
    let s = studioReducer(initialState(), { type: 'toggleBurst' });
    expect(s.burst).toBe(true);
    s = studioReducer(s, { type: 'setMode', mode: 'video' });
    expect(s.mode).toBe('video');
  });
});
