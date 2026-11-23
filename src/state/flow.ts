import {
  PALETTES, STYLE_META, getCategory, getPalette, getTemplate, suggestFromPrompt, type CategoryId, type StyleId,
} from './catalog';
import type { Mode } from './studio';

export type Page = 'home' | 'category' | 'suggestions' | 'customize' | 'result' | 'projects' | 'tools' | 'produce';
type Origin = 'home' | 'category' | 'suggestions' | 'projects';

export const REF_ROLES = ['Style reference', 'Character reference', 'Edit this image'] as const;
export type RefRole = (typeof REF_ROLES)[number];
export const RATIOS = ['Auto', 'Square', 'Wide', 'Portrait'] as const;
export type Ratio = (typeof RATIOS)[number];
export const MAX_PROJECTS = 16;
export const MAX_VARIATIONS = 4;
export const MAX_TEXT = 60;
export const MAX_IDEA = 1000;

export interface Brief {
  templateId: string | null;
  style: StyleId;
  paletteId: string;
  customColor: string | null;
  displayName: string;
  prompt: string;
  referenceName: string | null;
  referenceRole: RefRole | null;
  ratio: Ratio;
  variations: number;
  /** art style chosen on the Production page (id from production/styles.json) */
  artStyleId: string | null;
}

export interface SavedProject { id: string; savedAt: number; brief: Brief }

export interface FlowState {
  page: Page;
  categoryId: CategoryId;
  origin: Origin;
  brief: Brief;
  /** in-memory preview of the uploaded reference; never persisted */
  referencePreview: string | null;
  /** which fields were guessed from the prompt (shown as editable) */
  inferred: { template: boolean; palette: boolean };
  styleTouched: boolean;
  suggestionIds: string[];
  suggestionMatched: boolean;
  showErrors: boolean;
  notice: string | null;
  projects: SavedProject[];
  toolMode: Mode;
}

export type FlowAction =
  | { type: 'goHome' }
  | { type: 'openCategory'; categoryId: CategoryId }
  | { type: 'openProjects' }
  | { type: 'openTools'; mode: Mode }
  | { type: 'openProduce' }
  | { type: 'setArtStyle'; artStyleId: string }
  | { type: 'setArtworkType'; templateId: string | null }
  | { type: 'setPrompt'; prompt: string }
  | { type: 'submitPrompt' }
  | { type: 'pickTemplate'; templateId: string }
  | { type: 'setStyle'; style: StyleId }
  | { type: 'setPalette'; paletteId: string }
  | { type: 'setCustomColor'; color: string }
  | { type: 'setDisplayName'; name: string }
  | { type: 'setReference'; name: string; preview: string }
  | { type: 'clearReference' }
  | { type: 'setReferenceRole'; role: RefRole }
  | { type: 'setRatio'; ratio: Ratio }
  | { type: 'setVariations'; count: number }
  | { type: 'shuffle'; seed: number }
  | { type: 'back' }
  | { type: 'goToStep'; step: 1 | 2 | 3 }
  | { type: 'createBrief' }
  | { type: 'saveProject'; id: string; now: number }
  | { type: 'resumeProject'; id: string }
  | { type: 'removeProject'; id: string }
  | { type: 'notify'; message: string }
  | { type: 'dismissNotice' };

const emptyBrief = (): Brief => ({
  templateId: null, style: 'minimal', paletteId: PALETTES[0].id, customColor: null, displayName: '', prompt: '',
  referenceName: null, referenceRole: null, ratio: 'Auto', variations: 1, artStyleId: null,
});

export function initialFlow(): FlowState {
  return {
    page: 'home', categoryId: 'streaming', origin: 'home', brief: emptyBrief(), referencePreview: null,
    inferred: { template: false, palette: false }, styleTouched: false, suggestionIds: [], suggestionMatched: true,
    showErrors: false, notice: null, projects: [], toolMode: 'image',
  };
}

/** 1 Choose artwork · 2 Customize · 3 Create & refine. 0 = outside the guided flow. */
export function stepOf(page: Page): 0 | 1 | 2 | 3 {
  if (page === 'customize') return 2;
  if (page === 'result') return 3;
  if (page === 'projects' || page === 'tools' || page === 'produce') return 0;
  return 1;
}

export function briefIssues(brief: Brief): string[] {
  const issues: string[] = [];
  if (!getTemplate(brief.templateId)) issues.push('Choose an artwork first.');
  else if (brief.referenceName && !brief.referenceRole) issues.push('Tell us how to use your reference image.');
  return issues;
}

export function colorsOf(brief: Brief): { main: string; secondary: string; name: string } {
  const p = getPalette(brief.paletteId);
  return brief.customColor ? { main: brief.customColor, secondary: p.secondary, name: 'Custom colour' } : { main: p.main, secondary: p.secondary, name: p.name };
}

export function summarize(brief: Brief): string {
  const t = getTemplate(brief.templateId);
  return [t?.title ?? 'No artwork', STYLE_META[brief.style].name, colorsOf(brief).name].join(' · ');
}

/** The hand-off a Photoshop / Illustrator production pipeline would receive. */
export function toJobBrief(brief: Brief) {
  const t = getTemplate(brief.templateId);
  const c = colorsOf(brief);
  return {
    template: brief.templateId,
    title: t?.title ?? null,
    category: t ? getCategory(t.categoryId).name : null,
    madeIn: t?.madeIn ?? null,
    deliverables: t?.bundle ?? (t ? [t.title] : []),
    style: brief.style,
    colors: { main: c.main, secondary: c.secondary },
    text: brief.displayName.trim(),
    idea: brief.prompt.trim(),
    reference: brief.referenceName ? { file: brief.referenceName, role: brief.referenceRole } : null,
    canvas: brief.ratio,
    variations: brief.variations,
  };
}

const ORIGINS: Page[] = ['home', 'category', 'suggestions', 'projects'];

function withTemplate(state: FlowState, templateId: string, inferred: FlowState['inferred']): FlowState {
  const t = getTemplate(templateId);
  if (!t) return state;
  const origin = ORIGINS.includes(state.page) ? (state.page as Origin) : state.origin;
  let { style } = state.brief;
  let notice: string | null = null;
  if (!state.styleTouched) style = t.styles[0];
  else if (!t.styles.includes(style)) {
    notice = `${STYLE_META[style].name} isn't available for ${t.title}, so the style was reset to ${STYLE_META[t.styles[0]].name}. Everything else was kept.`;
    style = t.styles[0];
  }
  return {
    ...state, page: 'customize', origin, categoryId: t.categoryId, inferred, notice, showErrors: false,
    brief: { ...state.brief, templateId, style },
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));
const patch = (state: FlowState, brief: Partial<Brief>): FlowState => ({ ...state, brief: { ...state.brief, ...brief } });

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'goHome':
      return { ...state, page: 'home', notice: null, showErrors: false };
    case 'openCategory':
      return getCategory(action.categoryId).available && getCategory(action.categoryId).id === action.categoryId
        ? { ...state, page: 'category', categoryId: action.categoryId, notice: null }
        : state;
    case 'openProjects':
      return { ...state, page: 'projects', notice: null };
    case 'openTools':
      return { ...state, page: 'tools', toolMode: action.mode, notice: null };
    case 'openProduce':
      return { ...state, page: 'produce', notice: null, showErrors: false };
    case 'setArtStyle':
      return patch(state, { artStyleId: action.artStyleId });
    case 'setArtworkType':
      return action.templateId === null || getTemplate(action.templateId) ? patch(state, { templateId: action.templateId }) : state;
    case 'setPrompt':
      return patch(state, { prompt: action.prompt.slice(0, MAX_IDEA) });
    case 'submitPrompt': {
      if (state.brief.prompt.trim() === '') return state;
      const s = suggestFromPrompt(state.brief.prompt);
      const next = s.paletteId ? patch(state, { paletteId: s.paletteId, customColor: null }) : state;
      const palette = Boolean(s.paletteId);
      if (s.confident) return withTemplate(next, s.templates[0].id, { template: true, palette });
      return {
        ...next, page: 'suggestions', origin: 'home', notice: null, inferred: { template: false, palette },
        suggestionIds: s.templates.map((t) => t.id), suggestionMatched: s.matched,
      };
    }
    case 'pickTemplate':
      return withTemplate(state, action.templateId, { template: false, palette: state.inferred.palette });
    case 'setStyle': {
      const t = getTemplate(state.brief.templateId);
      if (t && !t.styles.includes(action.style)) return state;
      return { ...patch(state, { style: action.style }), styleTouched: true };
    }
    case 'setPalette':
      return PALETTES.some((p) => p.id === action.paletteId)
        ? { ...patch(state, { paletteId: action.paletteId, customColor: null }), inferred: { ...state.inferred, palette: false } }
        : state;
    case 'setCustomColor':
      return /^#[0-9a-f]{6}$/i.test(action.color)
        ? { ...patch(state, { customColor: action.color }), inferred: { ...state.inferred, palette: false } }
        : state;
    case 'setDisplayName':
      return patch(state, { displayName: action.name.slice(0, MAX_TEXT) });
    case 'setReference':
      return { ...patch(state, { referenceName: action.name, referenceRole: null }), referencePreview: action.preview, showErrors: false };
    case 'clearReference':
      return { ...patch(state, { referenceName: null, referenceRole: null }), referencePreview: null };
    case 'setReferenceRole':
      return patch(state, { referenceRole: action.role });
    case 'setRatio':
      return patch(state, { ratio: action.ratio });
    case 'setVariations':
      return patch(state, { variations: clamp(action.count, 1, MAX_VARIATIONS) });
    case 'shuffle': {
      const t = getTemplate(state.brief.templateId);
      if (!t) return state;
      const seed = Math.abs(Math.floor(action.seed));
      const styles = t.styles.filter((s) => s !== state.brief.style);
      const palettes = PALETTES.filter((p) => p.id !== state.brief.paletteId);
      return {
        ...patch(state, { style: styles[seed % styles.length] ?? state.brief.style, paletteId: palettes[seed % palettes.length].id, customColor: null }),
        page: 'customize', styleTouched: true, inferred: { ...state.inferred, palette: false },
        notice: 'New direction — your text, idea and reference were kept.',
      };
    }
    case 'back': {
      if (state.page === 'result') return { ...state, page: 'customize' };
      if (state.page === 'customize') return { ...state, page: state.origin, notice: null, showErrors: false };
      return { ...state, page: 'home', notice: null };
    }
    case 'goToStep': {
      if (action.step >= stepOf(state.page)) return state;
      if (action.step === 2) return { ...state, page: 'customize' };
      return { ...state, page: state.origin === 'suggestions' ? 'suggestions' : 'category', notice: null };
    }
    case 'createBrief':
      return briefIssues(state.brief).length > 0 ? { ...state, showErrors: true } : { ...state, page: 'result', showErrors: false, notice: null };
    case 'saveProject': {
      if (!getTemplate(state.brief.templateId)) return state;
      const project: SavedProject = { id: action.id, savedAt: action.now, brief: { ...state.brief, referenceName: null, referenceRole: null } };
      return { ...state, projects: [project, ...state.projects].slice(0, MAX_PROJECTS), notice: 'Saved to My Projects on this device.' };
    }
    case 'resumeProject': {
      const p = state.projects.find((x) => x.id === action.id);
      const t = getTemplate(p?.brief.templateId);
      if (!p || !t) return state;
      return {
        ...state, page: 'customize', origin: 'projects', categoryId: t.categoryId, brief: { ...p.brief }, referencePreview: null,
        styleTouched: true, inferred: { template: false, palette: false }, showErrors: false, notice: null,
      };
    }
    case 'removeProject':
      return { ...state, projects: state.projects.filter((p) => p.id !== action.id) };
    case 'notify':
      return { ...state, notice: action.message };
    case 'dismissNotice':
      return { ...state, notice: null };
  }
}

/* ---------- persistence (this device only; uploaded references are never stored) ---------- */

export const STORAGE_KEY = 'lumora_flow_v1';

export function serialize(state: FlowState): string {
  const strip = (b: Brief): Brief => ({ ...b, referenceName: null, referenceRole: null });
  return JSON.stringify({ brief: strip(state.brief), projects: state.projects.map((p) => ({ ...p, brief: strip(p.brief) })), categoryId: state.categoryId, styleTouched: state.styleTouched });
}

function cleanBrief(raw: unknown): Brief {
  const base = emptyBrief();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const t = getTemplate(typeof r.templateId === 'string' ? r.templateId : null);
  const style = typeof r.style === 'string' && r.style in STYLE_META ? (r.style as StyleId) : base.style;
  return {
    ...base,
    templateId: t ? t.id : null,
    style: t && !t.styles.includes(style) ? t.styles[0] : style,
    paletteId: PALETTES.some((p) => p.id === r.paletteId) ? (r.paletteId as string) : base.paletteId,
    customColor: typeof r.customColor === 'string' && /^#[0-9a-f]{6}$/i.test(r.customColor) ? r.customColor : null,
    displayName: typeof r.displayName === 'string' ? r.displayName.slice(0, MAX_TEXT) : '',
    prompt: typeof r.prompt === 'string' ? r.prompt.slice(0, MAX_IDEA) : '',
    ratio: RATIOS.includes(r.ratio as Ratio) ? (r.ratio as Ratio) : 'Auto',
    variations: typeof r.variations === 'number' ? clamp(r.variations, 1, MAX_VARIATIONS) : 1,
    artStyleId: typeof r.artStyleId === 'string' && /^[a-z0-9-]{1,40}$/.test(r.artStyleId) ? r.artStyleId : null,
  };
}

/** Rebuilds a safe state from untrusted stored JSON. Always lands on Home. */
export function hydrate(raw: unknown): FlowState {
  const state = initialFlow();
  if (!raw || typeof raw !== 'object') return state;
  const r = raw as Record<string, unknown>;
  const brief = cleanBrief(r.brief);
  const projects: SavedProject[] = Array.isArray(r.projects)
    ? r.projects
        .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object')
        .map((p) => ({ id: String(p.id ?? ''), savedAt: Number(p.savedAt) || 0, brief: cleanBrief(p.brief) }))
        .filter((p) => p.id !== '' && p.brief.templateId !== null)
        .slice(0, MAX_PROJECTS)
    : [];
  const t = getTemplate(brief.templateId);
  return { ...state, brief, projects, categoryId: t ? t.categoryId : state.categoryId, styleTouched: r.styleTouched === true };
}

export function loadFlow(storage: Pick<Storage, 'getItem'> | undefined): FlowState {
  try {
    return hydrate(JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return initialFlow();
  }
}
