/**
 * The universal quality rules (master skill §8, §9, §13): structured defects, the retry limit, the final art review
 * the server scores itself, and the brief check. Pure functions; every artwork type goes through them.
 */
import { describe, expect, it } from 'vitest';
import {
  CRAFT_RULES, FINAL_THRESHOLD, HARD_GATES, RUBRIC, briefIssues, defectSeverity, formatDefect, judgeFinalReview, maxStageCorrections,
  normaliseDefect, readFinalReviewReply, type FinalReviewReply,
} from './quality';

const allGates = Object.fromEntries(HARD_GATES.map((g) => [g.id, true])) as Record<string, boolean>;
const fullScores = Object.fromEntries(RUBRIC.map((r) => [r.id, r.weight])) as Record<string, number>;
const reply = (over: Partial<FinalReviewReply> = {}): FinalReviewReply => ({ scores: { ...fullScores }, notApplicable: {}, gates: { ...allGates }, defects: [], targets: [], comparedWith: ['brief', 'concept'], ...over });

describe('structured defects (spec §9)', () => {
  it('formats a defect with severity, where, what is wrong, what is expected and the exact fix', () => {
    const line = formatDefect({ severity: 'major', region: 'right hand, x 1180-1260 y 520-600', problem: 'thumb joins the wrong side of the palm', expected: 'thumb base on the inner palm edge', fix: 'redraw the thumb base and palm joint; keep the cuff' });
    expect(line).toBe('[major] right hand, x 1180-1260 y 520-600: thumb joins the wrong side of the palm. Expected: thumb base on the inner palm edge. Fix: redraw the thumb base and palm joint; keep the cuff');
    expect(defectSeverity(line)).toBe('major');
  });

  it('accepts a structured object or a plain string; an untagged string counts as major (never silently minor)', () => {
    expect(normaliseDefect({ severity: 'critical', region: 'face', problem: 'eyes at different heights', expected: 'level', fix: 'move the left eye up 12 px' })).toMatch(/^\[critical\] face: eyes/);
    expect(normaliseDefect('hair is a plain ellipse')).toBe('[major] hair is a plain ellipse');
    expect(normaliseDefect('[minor] petal edge slightly soft')).toBe('[minor] petal edge slightly soft');
    expect(defectSeverity('no tag here')).toBe('major');
  });

  it('drops empty or malformed defects and caps the length', () => {
    expect(normaliseDefect('   ')).toBeNull();
    expect(normaliseDefect(42)).toBeNull();
    expect(normaliseDefect({ severity: 'major' })).toBeNull();
    expect(normaliseDefect('x'.repeat(2000))!.length).toBeLessThanOrEqual(600);
  });
});

describe('retry limit (spec §9: configurable, default 6)', () => {
  it('defaults to 6 and reads LUMORA_MAX_STAGE_CORRECTIONS within 1-20', () => {
    expect(maxStageCorrections({})).toBe(6);
    expect(maxStageCorrections({ LUMORA_MAX_STAGE_CORRECTIONS: '3' })).toBe(3);
    for (const bad of ['0', '21', 'abc', '-2', '2.5', '']) expect(maxStageCorrections({ LUMORA_MAX_STAGE_CORRECTIONS: bad })).toBe(6);
  });
});

describe('final art review (spec §13): the server scores it, a render alone never passes', () => {
  it('uses the spec rubric weights (100 in all) and the 95 threshold', () => {
    expect(RUBRIC.reduce((n, r) => n + r.weight, 0)).toBe(100);
    expect(FINAL_THRESHOLD).toBe(95);
  });

  it('passes only with every hard gate, no critical/major defect and a server-computed score >= 95', () => {
    const j = judgeFinalReview(reply());
    expect(j.pass).toBe(true);
    expect(j.score).toBe(100);
  });

  it('fails below the threshold and says the score', () => {
    const j = judgeFinalReview(reply({ scores: { ...fullScores, anatomy: 4 } }));
    expect(j.score).toBe(94);
    expect(j.pass).toBe(false);
    expect(j.reasons.join(' ')).toMatch(/94/);
  });

  it('fails a perfect score when a hard gate fails (a score cannot override a gate)', () => {
    const j = judgeFinalReview(reply({ gates: { ...allGates, exact_text: false } }));
    expect(j.pass).toBe(false);
    expect(j.reasons.join(' ')).toMatch(/text/i);
  });

  it('fails a gate the reviewer did not answer', () => {
    const { exact_text: _t, ...rest } = allGates;
    expect(judgeFinalReview(reply({ gates: rest })).pass).toBe(false);
  });

  it('fails with any critical or major defect, passes with minor ones only', () => {
    expect(judgeFinalReview(reply({ defects: ['[major] cat: front paws fused into one shape'] })).pass).toBe(false);
    expect(judgeFinalReview(reply({ defects: ['[critical] title misspelled'] })).pass).toBe(false);
    expect(judgeFinalReview(reply({ defects: ['[minor] one star slightly large'] })).pass).toBe(true);
  });

  it('fails when a criterion has no score (nothing is assumed) and clamps scores to their weight', () => {
    const { anatomy: _a, ...missing } = fullScores;
    expect(judgeFinalReview(reply({ scores: missing })).pass).toBe(false);
    expect(judgeFinalReview(reply({ scores: { ...fullScores, colors: 500 } })).score).toBe(100);
  });

  it('normalises over the applicable criteria only when a criterion is not applicable with a reason', () => {
    const { materials: _m, ...rest } = fullScores;
    const j = judgeFinalReview(reply({ scores: rest, notApplicable: { materials: 'flat two-colour logo: no materials' } }));
    expect(j.pass).toBe(true);
    expect(j.score).toBe(100);
    expect(judgeFinalReview(reply({ scores: rest, notApplicable: { materials: '' } })).pass).toBe(false);
  });

  it('fails when the review did not compare against the brief', () => {
    expect(judgeFinalReview(reply({ comparedWith: ['concept'] })).pass).toBe(false);
  });
});

describe('reading the final reviewer reply', () => {
  const cli = (result: string) => JSON.stringify({ type: 'result', is_error: false, result });

  it('reads scores, gates, defects (structured or strings) and what it compared with', () => {
    const r = readFinalReviewReply(cli(JSON.stringify({
      scores: fullScores, gates: allGates, comparedWith: ['brief', 'concept', 'references'],
      defects: [{ severity: 'minor', region: 'sky', problem: 'one star too big', expected: 'smaller', fix: 'scale to 2 px', asset: 'stars', stage: 'line_art' }],
    })));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.review.defects[0]).toMatch(/^\[minor\] sky/);
    expect(r.review.targets).toEqual([{ asset: 'stars', stage: 'line_art', defect: r.review.defects[0] }]);
    expect(r.review.comparedWith).toEqual(['brief', 'concept', 'references']);
  });

  it('fails closed on no answer, an error result or unreadable JSON', () => {
    expect(readFinalReviewReply('').ok).toBe(false);
    expect(readFinalReviewReply(JSON.stringify({ type: 'result', is_error: true, result: '{}' })).ok).toBe(false);
    expect(readFinalReviewReply(cli('looks great!')).ok).toBe(false);
  });
});

describe('the drawing rules every run gets (universal, not per subject)', () => {
  const text = CRAFT_RULES.join('\n');
  it('forbids primitive shapes as the construction of organic forms and asks for custom Bezier paths', () => {
    expect(text).toMatch(/primitive/i);
    expect(text).toMatch(/Bezier/);
  });
  it('asks for reference-driven construction sketches, variable/tapered lines, individual assets, materials and one light', () => {
    expect(text).toMatch(/reference/i);
    expect(text).toMatch(/taper/i);
    expect(text).toMatch(/individual/i);
    expect(text).toMatch(/material/i);
    expect(text).toMatch(/light/i);
  });
  it('asks the creator to look at its own capture after every stage before reporting it', () => {
    expect(text).toMatch(/after every stage/i);
    expect(text).toMatch(/Read/);
  });
});

describe('brief check (validate the brief before any artwork)', () => {
  it('flags an empty brief and a brief that hit the length limit (its end may be cut off)', () => {
    expect(briefIssues('', 2000)).toEqual(['The brief is empty.']);
    expect(briefIssues('x'.repeat(2000), 2000).join(' ')).toMatch(/cut off/);
    expect(briefIssues('A fox mascot, orange and cream, no text.', 2000)).toEqual([]);
  });
  it('flags a pasted brief that was longer than the limit, with how much was lost', () => {
    expect(briefIssues('x'.repeat(2000), 2000, 4100).join(' ')).toMatch(/4,100/);
    expect(briefIssues('x'.repeat(2000), 2000, 4100).join(' ')).toMatch(/2,100/);
  });
});
