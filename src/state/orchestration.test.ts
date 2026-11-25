import { describe, expect, it } from 'vitest';
import {
  JOB_STATES, MAX_CONCEPT_ATTEMPTS, STAGES, buildRegistry, canTransition, newOrchestration, transition, viewStatus,
  type Orchestration,
} from './orchestration';

const at = 1_700_000_000_000;
const go = (o: Orchestration, to: Orchestration['state'], actor: 'server' | 'designer' = 'server') => {
  const r = transition(o, to, { actor, reason: `to ${to}`, at });
  if (!r.ok) throw new Error(r.error);
  return r.orchestration;
};

describe('job state machine (spec §3)', () => {
  it('has exactly the spec states', () => {
    expect(JOB_STATES).toEqual([
      'BRIEF_PENDING', 'ART_DIRECTION_READY', 'CONCEPT_GENERATING', 'CONCEPT_QA', 'CONCEPT_REVIEW', 'CONCEPT_APPROVED',
      'ASSET_PLANNING', 'PRODUCTION', 'STAGE_VERIFYING', 'STAGE_CORRECTING', 'HUMAN_INTERVENTION_REQUIRED', 'ASSEMBLY',
      'FINAL_QA', 'FINAL_REVIEW', 'EXPORTING', 'DELIVERED', 'CANCELLED',
    ]);
  });

  it('starts at BRIEF_PENDING with an empty history', () => {
    const o = newOrchestration(at);
    expect(o.state).toBe('BRIEF_PENDING');
    expect(o.history).toEqual([]);
    expect(o.concept.versions).toEqual([]);
    expect(o.concept.locked).toBeNull();
  });

  it('records every transition with actor, time, reason and evidence', () => {
    const o = newOrchestration(at);
    const r = transition(o, 'ART_DIRECTION_READY', { actor: 'server', reason: 'brief valid', at, evidence: ['plans/style_contract.json'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.orchestration.state).toBe('ART_DIRECTION_READY');
    expect(r.orchestration.history).toEqual([{ from: 'BRIEF_PENDING', to: 'ART_DIRECTION_READY', actor: 'server', at, reason: 'brief valid', evidence: ['plans/style_contract.json'] }]);
    // the input is not mutated
    expect(o.state).toBe('BRIEF_PENDING');
  });

  it('refuses skipping straight to production (no production before concept approval)', () => {
    const o = go(go(newOrchestration(at), 'ART_DIRECTION_READY'), 'CONCEPT_GENERATING');
    for (const to of ['PRODUCTION', 'ASSET_PLANNING', 'CONCEPT_APPROVED', 'EXPORTING', 'DELIVERED'] as const) {
      const r = transition(o, to, { actor: 'server', reason: 'x', at });
      expect(r.ok, to).toBe(false);
    }
  });

  it('only the designer can approve a concept or the final artwork', () => {
    let o = go(go(go(go(newOrchestration(at), 'ART_DIRECTION_READY'), 'CONCEPT_GENERATING'), 'CONCEPT_QA'), 'CONCEPT_REVIEW');
    expect(canTransition(o.state, 'CONCEPT_APPROVED', 'server')).toBe(false);
    expect(transition(o, 'CONCEPT_APPROVED', { actor: 'server', reason: 'self-approve', at }).ok).toBe(false);
    o = go(o, 'CONCEPT_APPROVED', 'designer');
    expect(o.state).toBe('CONCEPT_APPROVED');
    expect(canTransition('FINAL_REVIEW', 'EXPORTING', 'server')).toBe(false);
    expect(canTransition('FINAL_REVIEW', 'EXPORTING', 'designer')).toBe(true);
  });

  it('a designer rejection sends the concept back for generation', () => {
    expect(canTransition('CONCEPT_REVIEW', 'CONCEPT_GENERATING', 'designer')).toBe(true);
    expect(canTransition('CONCEPT_REVIEW', 'CONCEPT_GENERATING', 'server')).toBe(false);
  });

  it('the server cannot cancel; the designer can cancel any open job, and terminal states stay terminal', () => {
    for (const s of JOB_STATES.filter((x) => x !== 'DELIVERED' && x !== 'CANCELLED')) {
      expect(canTransition(s, 'CANCELLED', 'designer'), s).toBe(true);
      expect(canTransition(s, 'CANCELLED', 'server'), s).toBe(false);
    }
    for (const s of ['DELIVERED', 'CANCELLED'] as const) {
      for (const to of JOB_STATES) expect(canTransition(s, to, 'designer')).toBe(false);
    }
  });

  it('runs the whole happy path of the spec flowchart', () => {
    let o = newOrchestration(at);
    for (const [to, actor] of [
      ['ART_DIRECTION_READY', 'server'], ['CONCEPT_GENERATING', 'server'], ['CONCEPT_QA', 'server'], ['CONCEPT_REVIEW', 'server'],
      ['CONCEPT_APPROVED', 'designer'], ['ASSET_PLANNING', 'server'], ['PRODUCTION', 'server'], ['STAGE_VERIFYING', 'server'],
      ['STAGE_CORRECTING', 'server'], ['PRODUCTION', 'server'], ['STAGE_VERIFYING', 'server'], ['ASSEMBLY', 'server'],
      ['FINAL_QA', 'server'], ['FINAL_REVIEW', 'server'], ['STAGE_CORRECTING', 'designer'], ['PRODUCTION', 'server'],
      ['STAGE_VERIFYING', 'server'], ['ASSEMBLY', 'server'], ['FINAL_QA', 'server'], ['FINAL_REVIEW', 'server'],
      ['EXPORTING', 'designer'], ['DELIVERED', 'server'],
    ] as const) o = go(o, to, actor);
    expect(o.state).toBe('DELIVERED');
    expect(o.history).toHaveLength(22);
  });

  it('escalates to a human and resumes from there', () => {
    expect(canTransition('CONCEPT_QA', 'HUMAN_INTERVENTION_REQUIRED', 'server')).toBe(true);
    expect(canTransition('STAGE_VERIFYING', 'HUMAN_INTERVENTION_REQUIRED', 'server')).toBe(true);
    expect(canTransition('HUMAN_INTERVENTION_REQUIRED', 'CONCEPT_GENERATING', 'designer')).toBe(true);
    expect(canTransition('HUMAN_INTERVENTION_REQUIRED', 'STAGE_CORRECTING', 'designer')).toBe(true);
    // the server cannot resume on its own: a human has to look first
    expect(canTransition('HUMAN_INTERVENTION_REQUIRED', 'STAGE_CORRECTING', 'server')).toBe(false);
  });

  it('rejects unknown states', () => {
    const r = transition(newOrchestration(at), 'NOPE' as never, { actor: 'server', reason: 'x', at });
    expect(r.ok).toBe(false);
  });

  it('caps automatic concept attempts at 4', () => {
    expect(MAX_CONCEPT_ATTEMPTS).toBe(4);
  });

  it('maps states to the simple status the Jobs list shows', () => {
    expect(viewStatus('CONCEPT_GENERATING')).toBe('running');
    expect(viewStatus('PRODUCTION')).toBe('running');
    expect(viewStatus('CONCEPT_REVIEW')).toBe('review');
    expect(viewStatus('FINAL_REVIEW')).toBe('review');
    expect(viewStatus('HUMAN_INTERVENTION_REQUIRED')).toBe('failed');
    expect(viewStatus('CANCELLED')).toBe('failed');
    expect(viewStatus('DELIVERED')).toBe('done');
    expect(viewStatus('BRIEF_PENDING')).toBe('queued');
  });
});

describe('asset registry (spec §7, §11)', () => {
  it('has the seven stages in order', () => {
    expect(STAGES).toEqual(['sketch', 'line_art', 'color_fill', 'texture', 'shadows_highlights', 'effects', 'color_grading']);
  });

  it('builds one asset per plan part, every stage pending', () => {
    const reg = buildRegistry({ parts: [{ name: 'Background', app: 'Photoshop', detail: 'night sky' }, { name: 'Character > Hair', app: 'Illustrator', detail: '' }] }, { text: '' });
    expect(reg.map((a) => [a.id, a.name, a.parent, a.app])).toEqual([
      ['background', 'Background', null, 'Photoshop'],
      ['character-hair', 'Character > Hair', 'character', 'Illustrator'],
    ]);
    for (const a of reg) {
      expect(Object.keys(a.stages)).toEqual(STAGES);
      for (const s of STAGES) expect(a.stages[s]).toEqual({ status: 'pending', attempt: 0, reason: null, checkpoint: null, evidence: [], defects: [] });
    }
  });

  it('gives duplicate part names unique ids', () => {
    const reg = buildRegistry({ parts: [{ name: 'Star', app: 'Illustrator', detail: '' }, { name: 'Star', app: 'Illustrator', detail: '' }] }, { text: '' });
    expect(reg.map((a) => a.id)).toEqual(['star', 'star-2']);
  });

  it('without a plan: background, main subject, and the title only when there is text', () => {
    expect(buildRegistry(null, { text: '' }).map((a) => a.id)).toEqual(['background', 'main-subject']);
    expect(buildRegistry(null, { text: 'NightWolf' }).map((a) => a.id)).toEqual(['background', 'main-subject', 'title']);
  });
});
