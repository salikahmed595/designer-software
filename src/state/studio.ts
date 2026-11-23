import { isStyleId } from './styles';

export const MODES = ['image', 'edit', 'video', 'music', 'voice', 'sound', 'graphic'] as const;
export type Mode = (typeof MODES)[number];

export const ASPECTS = ['Auto', '1:1', '4:5', '3:2', '16:9', '9:16'] as const;
export type Aspect = (typeof ASPECTS)[number];

export const MODELS = ['Auto', 'Nova XL', 'Prism 2', 'Draftline'] as const;
export type Model = (typeof MODELS)[number];

export const IMAGE_TYPES = ['Image', 'Vector', 'Icon', 'Pattern'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

export const MIN_COUNT = 1;
export const MAX_COUNT = 4;

export interface Session {
  id: string;
  prompt: string;
  styleId: string;
  count: number;
  aspect: Aspect;
  status: 'loading' | 'done';
  createdAt: number;
}

export interface StudioState {
  credits: number;
  maxCredits: number;
  prompt: string;
  mode: Mode;
  burst: boolean;
  styleId: string;
  aspect: Aspect;
  count: number;
  model: Model;
  imageType: ImageType;
  referenceName: string | null;
  sessions: Session[];
}

export type StudioAction =
  | { type: 'setPrompt'; prompt: string }
  | { type: 'setMode'; mode: Mode }
  | { type: 'toggleBurst' }
  | { type: 'setStyle'; styleId: string }
  | { type: 'setAspect'; aspect: Aspect }
  | { type: 'setCount'; count: number }
  | { type: 'setModel'; model: Model }
  | { type: 'setImageType'; imageType: ImageType }
  | { type: 'setReference'; name: string | null }
  | { type: 'generate'; id: string; now: number }
  | { type: 'completeSession'; id: string };

export const MAX_PROMPT = 2000;

const SEED_SESSIONS: Session[] = [
  { id: 'seed-1', prompt: 'Elf maid character turnaround, clean cel shading', styleId: 'default-illustration', count: 2, aspect: '3:2', status: 'done', createdAt: 4 },
  { id: 'seed-2', prompt: 'Two boxers mid-swing under warehouse lights', styleId: 'a24-cinematic', count: 2, aspect: '3:2', status: 'done', createdAt: 3 },
  { id: 'seed-3', prompt: 'Brooding man in a leather jacket, ink comic panel', styleId: '1980s-comic', count: 2, aspect: '3:2', status: 'done', createdAt: 2 },
  { id: 'seed-4', prompt: 'Sorceress in red against a giant moon', styleId: 'bathed-in-drama', count: 1, aspect: '3:2', status: 'done', createdAt: 1 },
];

export function initialState(): StudioState {
  return {
    credits: 20,
    maxCredits: 20,
    prompt: '',
    mode: 'image',
    burst: false,
    styleId: '35mm-time-capsule',
    aspect: 'Auto',
    count: 1,
    model: 'Auto',
    imageType: 'Image',
    referenceName: null,
    sessions: SEED_SESSIONS,
  };
}

export const costOf = (s: Pick<StudioState, 'count' | 'burst'>): number => s.count * (s.burst ? 2 : 1);

export function generateBlockReason(s: StudioState): string | null {
  if (s.prompt.trim() === '') return 'Enter a prompt to enable Generate.';
  if (s.credits < costOf(s)) return `Not enough credits: needs ${costOf(s)}, you have ${s.credits}.`;
  return null;
}

export const canGenerate = (s: StudioState): boolean => generateBlockReason(s) === null;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case 'setPrompt':
      return { ...state, prompt: action.prompt.slice(0, MAX_PROMPT) };
    case 'setMode':
      return { ...state, mode: action.mode };
    case 'toggleBurst':
      return { ...state, burst: !state.burst };
    case 'setStyle':
      return isStyleId(action.styleId) ? { ...state, styleId: action.styleId } : state;
    case 'setAspect':
      return { ...state, aspect: action.aspect };
    case 'setCount':
      return { ...state, count: clamp(action.count, MIN_COUNT, MAX_COUNT) };
    case 'setModel':
      return { ...state, model: action.model };
    case 'setImageType':
      return { ...state, imageType: action.imageType };
    case 'setReference':
      return { ...state, referenceName: action.name };
    case 'generate': {
      if (!canGenerate(state)) return state;
      const session: Session = {
        id: action.id,
        prompt: state.prompt.trim(),
        styleId: state.styleId,
        count: state.count,
        aspect: state.aspect,
        status: 'loading',
        createdAt: action.now,
      };
      return { ...state, credits: state.credits - costOf(state), sessions: [session, ...state.sessions] };
    }
    case 'completeSession': {
      if (!state.sessions.some((x) => x.id === action.id)) return state;
      return { ...state, sessions: state.sessions.map((x) => (x.id === action.id ? { ...x, status: 'done' } : x)) };
    }
  }
}
