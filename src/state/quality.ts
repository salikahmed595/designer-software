/**
 * Universal quality rules for every orchestrated artwork (master skill §8, §9, §13), whatever the subject:
 *  - the drawing rules every Creator run gets (custom Bezier construction, reference-driven sketches, tapered
 *    variable lines, individually designed assets, materials, one light, self-inspection after every stage);
 *  - what the independent verifier checks per stage and always rejects;
 *  - structured defects (severity, where, what is wrong, what is expected, the exact fix);
 *  - the configurable retry limit;
 *  - the final art review: the reviewer gives criterion scores and hard gates, the SERVER computes the score and
 *    the verdict. A render that exists is never a pass on its own;
 *  - the brief check that runs before any artwork.
 * Pure functions only, so the browser, the server and the tests share one source of truth.
 */
import type { Stage } from './orchestration';

/* ---------- drawing rules for the Creator ---------- */

export const CRAFT_RULES: string[] = [
  'Construction: build every organic form (bodies, faces, hands, hair, fur, cloth and folds, animals, plants, flames, curved lettering) from custom paths with deliberately placed Bezier anchors and handles. Primitive shapes (ellipses, circles, rectangles, polygons, stars) may block in volumes during the sketch, or stand for things that really are geometric (a moon disc, a window grid, a UI frame) — never as the final construction of a character, animal or organic form. An asset finished as a few stacked primitives is not finished.',
  'Reference-driven sketch: before each asset, study references for it — the approved plan, the style contract, the client reference if there is one, and licensed study references from the design-assets tools (art_search; study only, never placed or traced) — plus real anatomy, perspective and material knowledge. The Sketch stage shows construction: gesture/action line, volumes, joints, centre and eye lines, perspective guides, proportions measured in one unit (head heights). Name the references you used in the stage report ("references").',
  'Anatomy and gesture: one proportion system per figure; joints bend the right way; hands have a palm block, a thumb on the correct side and fingers with three segments of believable length; faces sit on centre and eye lines with the expression the plan asks for; animals follow their skeleton and paw structure; the silhouette must read as one clear shape when filled solid.',
  'Line art: variable line thickness with tapered ends — heavier on the outer silhouette and the shadow side, thinner on interior detail, tapering where lines end or turn. Build tapered strokes as filled vector shapes (two offset curves meeting at sharp ends) or with width/pressure profiles; never one uniform stroke weight for a whole asset. No wobble, gaps, double contours, accidental tangents or excess anchors.',
  'Design every asset individually: no copy-pasted duplicates. Windows, buildings, flowers, leaves, stars, tiles, petals, folds and hair locks vary in shape, size, angle and spacing. Repeat only what is truly repetitive in the subject, and vary it even then. No template layouts or stock clip-art shapes.',
  'Materials: give each material its own treatment that follows form, scale and perspective (skin, fabric, metal, leather, hair, fur, wood, stone, foliage, glass, neon). No single generic texture overlay; no noise for its own sake; no artificial gloss.',
  'Light: use the one light direction from the plan on every asset. Form shadows and cast/contact shadows fall on the side away from the light; highlights only where the light hits and only as strong as the material allows; reflected or rim light only where a real secondary source exists.',
  'Composition: professional illustration principles, not a template — one clear focal point, a value hierarchy, a readable silhouette, overlap and scale for depth, deliberate negative space, the text in its planned safe area.',
  'Inspect after every stage: export the capture, Read it, and export and Read a zoomed crop of the most detailed area (for example evidence/<asset>/<stage>/<run>/capture-detail.png, listed in "captures"). Compare them with the plan, the style contract and these rules, and fix what is wrong before writing the stage report. A stage that only rendered is not done. Say what you checked and fixed in the report ("self_check").',
  'Editability: keep every path, layer and asset editable and separate. Never flatten, merge, rasterize vector parts or convert live text to outlines in the master files.',
];

/* ---------- what the independent verifier checks ---------- */

export const STAGE_CHECK: Record<Stage, string> = {
  sketch: 'construction is visible and correct: gesture line, volumes, joints, proportions in one unit, perspective guides; anatomy (hands, faces, animal structure) and placement match the plan; the silhouette reads; nothing is missing',
  line_art: 'custom Bezier contours, not primitives; variable line weight with tapered ends (heavier silhouette, thinner interior); clean joins; closed shapes where fills need them; no wobble, gaps, double contours or stray marks',
  color_fill: 'flat base colours fill every region exactly, only palette colours, clean region separation; no gaps, halos or spill; no premature shading',
  texture: 'each material has its own texture that follows form and scale; not one pasted overlay, not noise; flat styles may be not applicable with a sound reason',
  shadows_highlights: 'one consistent light direction shared with the rest of the artwork; shadows describe form; cast and contact shadows present; highlights controlled and material-specific; no plastic gloss',
  effects: 'only effects the plan needs, restrained and readable; no blur hiding detail, no bloom or glow haze, no clutter; if not applicable, the reason is sound for this asset',
  color_grading: 'cohesive grade across the asset in context, palette and value hierarchy as planned; no muddy, crushed or clipped areas; brand colours preserved',
};

/** Always a fail, at any stage where it shows. */
export const ALWAYS_REJECT: string[] = [
  'a character, animal or organic form built from stacked primitive shapes (ellipses, circles, rectangles, polygons)',
  'one uniform line weight for a whole asset where the style needs line art',
  'malformed anatomy: wrong finger count or order, a thumb on the wrong side, joints bending the wrong way, eyes misaligned',
  'copy-pasted duplicates or template / clip-art shapes where the plan asks for individually designed elements',
  'lighting that contradicts the planned light direction',
  'blur, glow haze or noise used to hide missing detail',
  'anything that merely rendered without meeting the stage check — a render is never a pass on its own',
];

/* ---------- structured defects ---------- */

export const SEVERITIES = ['critical', 'major', 'minor'] as const;
export type Severity = (typeof SEVERITIES)[number];
export interface Defect { severity: Severity; region?: string; problem: string; expected?: string; fix?: string }

const DEFECT_MAX = 600;
const TAG = /^\[(critical|major|minor)\]\s*/i;
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const isSeverity = (v: unknown): v is Severity => typeof v === 'string' && (SEVERITIES as readonly string[]).includes(v.toLowerCase());

/** One line the next correction run can act on: "[major] where: what is wrong. Expected: … Fix: …". */
export function formatDefect(d: Defect): string {
  const head = `[${d.severity}] ${d.region ? `${d.region}: ` : ''}${d.problem}`;
  const parts = [head, d.expected ? `Expected: ${d.expected}` : '', d.fix ? `Fix: ${d.fix}` : ''].filter(Boolean);
  return parts.join('. ').slice(0, DEFECT_MAX);
}

/** A verifier defect (object or string) as one tagged line; untagged strings count as major. Null when unusable. */
export function normaliseDefect(raw: unknown): string | null {
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return null;
    return (TAG.test(s) ? s.replace(TAG, (_m, sev: string) => `[${sev.toLowerCase()}] `) : `[major] ${s}`).slice(0, DEFECT_MAX);
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const problem = str(o.problem);
  if (!problem) return null;
  const severity: Severity = isSeverity(o.severity) ? (o.severity.toLowerCase() as Severity) : 'major';
  return formatDefect({ severity, region: str(o.region) || undefined, problem, expected: str(o.expected) || undefined, fix: str(o.fix) || undefined });
}

export function defectSeverity(line: string): Severity {
  const m = TAG.exec(line.trim());
  return m ? (m[1].toLowerCase() as Severity) : 'major';
}

/** Critical and major defects block; minor ones may be accepted by the designer. */
export const isBlocking = (line: string): boolean => defectSeverity(line) !== 'minor';

/* ---------- retry limit ---------- */

export const DEFAULT_STAGE_CORRECTIONS = 6;
/** Corrections per stage before a human is asked: LUMORA_MAX_STAGE_CORRECTIONS (1-20), default 6. */
export function maxStageCorrections(env: Record<string, string | undefined>): number {
  const raw = (env.LUMORA_MAX_STAGE_CORRECTIONS ?? '').trim();
  if (!/^\d+$/.test(raw)) return DEFAULT_STAGE_CORRECTIONS;
  const n = Number(raw);
  return n >= 1 && n <= 20 ? n : DEFAULT_STAGE_CORRECTIONS;
}

/* ---------- final art review (spec §13) ---------- */

export const RUBRIC = [
  { id: 'brief', weight: 20, label: 'brief compliance: every hard requirement in the client brief and the approved plan' },
  { id: 'direction', weight: 15, label: 'artistic direction: the approved style, not a generic AI look; professional illustrator quality' },
  { id: 'anatomy', weight: 10, label: 'anatomy, gesture, proportions and expressions (or geometric accuracy for non-figures)' },
  { id: 'line_shape', weight: 10, label: 'line and shape quality: custom curves, variable tapered lines, clean silhouettes' },
  { id: 'colors', weight: 10, label: 'colours: the planned palette, value hierarchy, controlled accents' },
  { id: 'materials', weight: 10, label: 'materials: each material treated individually' },
  { id: 'lighting', weight: 10, label: 'lighting: one consistent light, shadows and highlights that describe form' },
  { id: 'composition', weight: 5, label: 'composition and background: focal point, depth without blur, individually designed elements' },
  { id: 'detail_effects', weight: 5, label: 'detail and effects: intentional, restrained, no clutter' },
  { id: 'editability', weight: 5, label: 'editability as far as the captures show: separate parts, live text' },
] as const;
export type RubricId = (typeof RUBRIC)[number]['id'];

export const HARD_GATES = [
  { id: 'exact_text', label: 'the text in the artwork is exactly the requested text, correctly spelled, and nothing else unless the plan asks for it' },
  { id: 'dimensions', label: 'the artwork is the requested size and aspect' },
  { id: 'all_assets', label: 'every part in the asset list is present and readable' },
  { id: 'brief_must_haves', label: 'every must-have in the brief is visibly met' },
  { id: 'brief_must_not', label: 'nothing the brief forbids appears' },
  { id: 'organic_construction', label: 'characters, animals and organic forms are custom-constructed shapes, not stacked primitives' },
] as const;

export const FINAL_THRESHOLD = 95;

export interface FinalReviewReply {
  scores: Partial<Record<string, number>>;
  /** criterion id → why it does not apply (an empty reason does not count) */
  notApplicable: Partial<Record<string, string>>;
  gates: Partial<Record<string, boolean>>;
  /** tagged defect lines */
  defects: string[];
  /** defects the reviewer traced to an asset and stage */
  targets: Array<{ asset: string; stage: Stage; defect: string }>;
  /** what the reviewer actually compared the artwork with: "brief", "concept", "references" */
  comparedWith: string[];
}
export interface FinalJudgement { pass: boolean; score: number | null; reasons: string[] }

/** The server's verdict. The reviewer's own total, if any, is ignored. */
export function judgeFinalReview(r: FinalReviewReply, threshold = FINAL_THRESHOLD): FinalJudgement {
  const reasons: string[] = [];
  let got = 0;
  let possible = 0;
  for (const c of RUBRIC) {
    const na = str(r.notApplicable[c.id]);
    const s = r.scores[c.id];
    if (na && typeof s !== 'number') continue;
    if (typeof s !== 'number' || !Number.isFinite(s)) {
      reasons.push(`No score for "${c.id}" (${c.label}).`);
      continue;
    }
    got += Math.min(Math.max(s, 0), c.weight);
    possible += c.weight;
  }
  const score = possible > 0 ? Math.round((got / possible) * 1000) / 10 : null;
  for (const g of HARD_GATES) if (r.gates[g.id] !== true) reasons.push(`Hard gate failed or unanswered: ${g.id} (${g.label}).`);
  const blocking = r.defects.filter(isBlocking);
  if (blocking.length > 0) reasons.push(`${blocking.length} critical/major defect${blocking.length === 1 ? '' : 's'}: ${blocking.slice(0, 3).join(' | ')}`);
  if (!r.comparedWith.map((x) => x.toLowerCase()).includes('brief')) reasons.push('The review did not compare the artwork with the client brief.');
  if (score === null) reasons.push('No criterion could be scored.');
  else if (score < threshold) reasons.push(`Score ${score}/100 is below the ${threshold} threshold.`);
  return { pass: reasons.length === 0, score, reasons };
}

/** The `result` text of a `claude -p --output-format json` run, or null (error, or no answer). */
export function readCliResult(cliOutput: string): string | null {
  let result: string | null = null;
  for (const line of cliOutput.split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue;
    try {
      const j = JSON.parse(line) as { type?: unknown; is_error?: unknown; result?: unknown };
      if (j.type === 'result' && typeof j.result === 'string' && j.is_error !== true) result = j.result;
    } catch {
      /* not the result line */
    }
  }
  return result;
}

/** The first {...} object in a model reply, or null. */
export function jsonObjectIn(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(text.slice(start, end + 1)) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const STAGE_IDS: readonly string[] = ['sketch', 'line_art', 'color_fill', 'texture', 'shadows_highlights', 'effects', 'color_grading'];

/** The final reviewer's reply. Anything unreadable fails closed. */
export function readFinalReviewReply(cliOutput: string): { ok: true; review: FinalReviewReply } | { ok: false; error: string } {
  const result = readCliResult(cliOutput);
  if (result === null) return { ok: false, error: 'The final reviewer did not answer.' };
  const o = jsonObjectIn(result);
  if (!o || typeof o.scores !== 'object' || o.scores === null || typeof o.gates !== 'object' || o.gates === null) {
    return { ok: false, error: 'The final reviewer’s reply had no scores and gates.' };
  }
  const scores: Record<string, number> = {};
  for (const [k, v] of Object.entries(o.scores as Record<string, unknown>)) if (typeof v === 'number' && Number.isFinite(v)) scores[k] = v;
  const gates: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(o.gates as Record<string, unknown>)) if (typeof v === 'boolean') gates[k] = v;
  const notApplicable: Record<string, string> = {};
  if (o.notApplicable && typeof o.notApplicable === 'object') {
    for (const [k, v] of Object.entries(o.notApplicable as Record<string, unknown>)) if (typeof v === 'string' && v.trim()) notApplicable[k] = v.trim().slice(0, 300);
  }
  const defects: string[] = [];
  const targets: FinalReviewReply['targets'] = [];
  for (const raw of (Array.isArray(o.defects) ? o.defects : []).slice(0, 30)) {
    const line = normaliseDefect(raw);
    if (!line) continue;
    defects.push(line);
    const r = raw as Record<string, unknown> | null;
    if (r && typeof r === 'object' && typeof r.asset === 'string' && STAGE_IDS.includes(String(r.stage))) targets.push({ asset: r.asset, stage: r.stage as Stage, defect: line });
  }
  const comparedWith = (Array.isArray(o.comparedWith) ? o.comparedWith : []).filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean).slice(0, 10);
  return { ok: true, review: { scores, gates, notApplicable, defects, targets, comparedWith } };
}

/* ---------- the brief check ---------- */

const n = (x: number) => x.toLocaleString('en-US');

/** Problems with the brief that must be fixed before any artwork is planned. `pastedLength` = what the designer pasted. */
export function briefIssues(brief: string, max: number, pastedLength?: number): string[] {
  if (!brief.trim()) return ['The brief is empty.'];
  if (pastedLength !== undefined && pastedLength > max) {
    return [`The pasted brief was ${n(pastedLength)} characters but only ${n(max)} fit, so the last ${n(pastedLength - max)} were cut off. Shorten it so nothing the client asked for is lost.`];
  }
  if (brief.length >= max) return [`The brief reached the ${n(max)}-character limit, so its end may be cut off. Check that the last line is complete.`];
  return [];
}
