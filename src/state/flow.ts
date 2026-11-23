/**
 * The whole app is three screens:
 *   home  — choose the artwork
 *   brief — art style, client brief, reference, size → send
 *   jobs  — what the agent is drawing, and the finished artwork
 */
import { getTemplate } from './catalog';

export type Page = 'home' | 'brief' | 'jobs';

export const REF_ROLES = ['Style reference', 'Character reference', 'Edit this image'] as const;
export type RefRole = (typeof REF_ROLES)[number];
export const RATIOS = ['Auto', 'Square', 'Wide', 'Portrait'] as const;
export type Ratio = (typeof RATIOS)[number];
export const MAX_TEXT = 60;
export const MAX_BRIEF_CHARS = 2000;

export interface Brief {
  templateId: string | null;
  /** id from production/styles.json */
  artStyleId: string | null;
  /** what the client asked for */
  prompt: string;
  /** optional name or text to put on the artwork */
  displayName: string;
  referenceName: string | null;
  referenceRole: RefRole | null;
  ratio: Ratio;
}

export interface FlowState {
  page: Page;
  brief: Brief;
  /** in-memory copy of the uploaded reference; never saved to the device */
  referencePreview: string | null;
  showErrors: boolean;
  notice: string | null;
}

export type FlowAction =
  | { type: 'goHome' }
  | { type: 'openJobs' }
  | { type: 'back' }
  | { type: 'pickTemplate'; templateId: string }
  | { type: 'setArtStyle'; artStyleId: string }
  | { type: 'setPrompt'; prompt: string }
  | { type: 'setDisplayName'; name: string }
  | { type: 'setReference'; name: string; preview: string }
  | { type: 'clearReference' }
  | { type: 'setReferenceRole'; role: RefRole }
  | { type: 'setRatio'; ratio: Ratio }
  | { type: 'showErrors' }
  | { type: 'jobSent' }
  | { type: 'notify'; message: string }
  | { type: 'dismissNotice' };

const emptyBrief = (): Brief => ({
  templateId: null, artStyleId: null, prompt: '', displayName: '', referenceName: null, referenceRole: null, ratio: 'Auto',
});

export const initialFlow = (): FlowState => ({ page: 'home', brief: emptyBrief(), referencePreview: null, showErrors: false, notice: null });

const patch = (state: FlowState, brief: Partial<Brief>): FlowState => ({ ...state, brief: { ...state.brief, ...brief } });

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'goHome':
    case 'back':
      return { ...state, page: 'home', showErrors: false, notice: null };
    case 'openJobs':
      return { ...state, page: 'jobs', showErrors: false, notice: null };
    case 'pickTemplate':
      return getTemplate(action.templateId) ? { ...patch(state, { templateId: action.templateId }), page: 'brief', showErrors: false, notice: null } : state;
    case 'setArtStyle':
      return patch(state, { artStyleId: action.artStyleId });
    case 'setPrompt':
      return patch(state, { prompt: action.prompt.slice(0, MAX_BRIEF_CHARS) });
    case 'setDisplayName':
      return patch(state, { displayName: action.name.slice(0, MAX_TEXT) });
    case 'setReference':
      return { ...patch(state, { referenceName: action.name, referenceRole: null }), referencePreview: action.preview };
    case 'clearReference':
      return { ...patch(state, { referenceName: null, referenceRole: null }), referencePreview: null };
    case 'setReferenceRole':
      return patch(state, { referenceRole: action.role });
    case 'setRatio':
      return patch(state, { ratio: action.ratio });
    case 'showErrors':
      return { ...state, showErrors: true };
    case 'jobSent':
      return { ...initialFlow(), page: 'jobs', notice: 'Sent. You can start the next artwork while this one is being drawn.' };
    case 'notify':
      return { ...state, notice: action.message };
    case 'dismissNotice':
      return { ...state, notice: null };
  }
}

/* ---------- saved on this device (the uploaded reference image is never stored) ---------- */

export const STORAGE_KEY = 'lumora_brief_v2';

export const serialize = (state: FlowState): string => JSON.stringify({ brief: { ...state.brief, referenceName: null, referenceRole: null } });

/** Rebuilds a safe state from untrusted stored JSON. Always opens on the first screen. */
export function hydrate(raw: unknown): FlowState {
  const state = initialFlow();
  const r = raw && typeof raw === 'object' ? (raw as { brief?: unknown }).brief : null;
  if (!r || typeof r !== 'object') return state;
  const b = r as Record<string, unknown>;
  return {
    ...state,
    brief: {
      ...state.brief,
      templateId: getTemplate(typeof b.templateId === 'string' ? b.templateId : null)?.id ?? null,
      artStyleId: typeof b.artStyleId === 'string' && /^[a-z0-9-]{1,40}$/.test(b.artStyleId) ? b.artStyleId : null,
      prompt: typeof b.prompt === 'string' ? b.prompt.slice(0, MAX_BRIEF_CHARS) : '',
      displayName: typeof b.displayName === 'string' ? b.displayName.slice(0, MAX_TEXT) : '',
      ratio: RATIOS.find((x) => x === b.ratio) ?? 'Auto',
    },
  };
}

export function loadFlow(storage: Pick<Storage, 'getItem'> | undefined): FlowState {
  try {
    return hydrate(JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return initialFlow();
  }
}
