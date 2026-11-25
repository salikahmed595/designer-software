import { describe, expect, it } from 'vitest';
import { combineReadiness, engineRefusal } from './readiness';

const ok = (detail: string) => ({ ok: true, detail });
const no = (detail: string) => ({ ok: false, detail });

describe('which drawing apps are ready', () => {
  it('runs the agent when at least one pair of apps is connected, and keeps each pair’s own reason', () => {
    const r = combineReadiness(no('Photoshop is not installed.'), ok('Connected: PhotoCraft 0.23.1, VectorCraft 0.24.1 (headless).'));
    expect(r.runner).toBe('claude');
    expect(r.engines.adobe).toEqual({ ok: false, detail: 'Photoshop is not installed.' });
    expect(r.engines.craft.ok).toBe(true);
    expect(r.detail).toContain('PhotoCraft 0.23.1');
    expect(r.detail).toContain('Photoshop is not installed.');
  });

  it('switches the agent off when neither pair is connected', () => {
    expect(combineReadiness(no('a'), no('b')).runner).toBe('off');
  });

  it('runs with Adobe alone, exactly as before engines existed', () => {
    const r = combineReadiness(ok('Connected: Photoshop 2023, Illustrator 2022.'), no('PhotoCraft is not connected to Claude Code.'));
    expect(r.runner).toBe('claude');
    expect(r.engines.craft.ok).toBe(false);
  });
});

describe('refusing a job whose apps are not connected', () => {
  const engines = { adobe: ok('fine'), craft: no('VectorCraft could not be started: its program is not where it was registered.') };

  it('says why, naming the apps, when the real agent would draw it', () => {
    expect(engineRefusal('claude', engines, 'craft')).toMatch(/PhotoCraft \+ VectorCraft.*not ready.*VectorCraft could not be started/);
    expect(engineRefusal('claude', engines, 'adobe')).toBeNull();
  });

  it('treats a job with no apps chosen as an Adobe job', () => {
    expect(engineRefusal('claude', { adobe: no('Illustrator is missing.'), craft: ok('x') }, undefined)).toMatch(/Illustrator is missing/);
  });

  it('never refuses for the demo runner or when the agent is off (the job is saved and waits)', () => {
    expect(engineRefusal('mock', engines, 'craft')).toBeNull();
    expect(engineRefusal('off', engines, 'craft')).toBeNull();
  });
});
