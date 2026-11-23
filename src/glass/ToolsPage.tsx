import { useCallback, useEffect, useReducer, useRef, useState, type Dispatch } from 'react';
import { PromptCard } from '../components/PromptCard';
import { SessionsGrid } from '../components/SessionsGrid';
import { StyleModal } from '../components/StyleModal';
import { IconEdit, IconImage, IconMic, IconMusic, IconPenTool, IconSpark, IconVideo, IconWave } from '../components/icons';
import { MODES, canGenerate, initialState, studioReducer, type Mode, type StudioAction, type StudioState } from '../state/studio';
import { Breadcrumb } from './ui';

const GENERATION_MS = 2500;

const MODE_META: Record<Mode, { label: string; Icon: typeof IconImage }> = {
  image: { label: 'Image', Icon: IconImage },
  edit: { label: 'Edit', Icon: IconEdit },
  video: { label: 'Video', Icon: IconVideo },
  music: { label: 'Music', Icon: IconMusic },
  voice: { label: 'Voice', Icon: IconMic },
  sound: { label: 'Sound', Icon: IconWave },
  graphic: { label: 'Graphic', Icon: IconPenTool },
};

let seq = 0;

export interface ClassicStudio { state: StudioState; dispatch: Dispatch<StudioAction>; onGenerate: () => void }

/** State for the classic generators. Lives in App so it survives leaving the Tools page. */
export function useClassicStudio(): ClassicStudio {
  const [state, dispatch] = useReducer(studioReducer, undefined, initialState);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const onGenerate = useCallback(() => {
    if (!canGenerate(state)) return;
    const id = `gen-${Date.now().toString(36)}-${(seq++).toString(36)}`;
    dispatch({ type: 'generate', id, now: Date.now() });
    const t = setTimeout(() => {
      timers.current.delete(t);
      dispatch({ type: 'completeSession', id });
    }, GENERATION_MS);
    timers.current.add(t);
  }, [state]);

  return { state, dispatch, onGenerate };
}

/** Secondary navigation: the original Image / Edit / Video / Music / Voice / Sound / Graphic generators. */
export function ToolsPage({ studio, onHome, onNotify }: { studio: ClassicStudio; onHome: () => void; onNotify: (message: string) => void }) {
  const { state, dispatch, onGenerate } = studio;
  const [styleOpen, setStyleOpen] = useState(false);
  const styleChipRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !styleOpen) styleChipRef.current?.focus();
    wasOpen.current = styleOpen;
  }, [styleOpen]);

  const onModeKey = (e: React.KeyboardEvent) => {
    const i = MODES.indexOf(state.mode);
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % MODES.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + MODES.length) % MODES.length;
    else return;
    e.preventDefault();
    dispatch({ type: 'setMode', mode: MODES[next] });
    document.getElementById(`mode-${MODES[next]}`)?.focus();
  };

  return (
    <section className="stage">
      <Breadcrumb items={[{ label: 'Home', onClick: onHome }, { label: 'Tools' }]} />
      <div className="stage-head">
        <div>
          <p className="tiny">Tools · Classic generators</p>
          <h1 id="page-title" tabIndex={-1}>{MODE_META[state.mode].label} generator</h1>
          <p className="stage-sub">The original prompt tools. Generation here is a demo and is not connected to a backend.</p>
        </div>
        <span className="pill" title="Each image costs 1 credit; Burst doubles it">
          <IconSpark width={13} height={13} className="text-[var(--accent)]" /> {state.credits} AI credits
        </span>
      </div>

      <div role="tablist" aria-label="Generation mode" onKeyDown={onModeKey} className="scrollbar-none flex max-w-full gap-1 overflow-x-auto pb-1 sm:gap-2">
        {MODES.map((m) => {
          const { label, Icon } = MODE_META[m];
          const selected = state.mode === m;
          return (
            <button
              key={m}
              id={`mode-${m}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="mode-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => dispatch({ type: 'setMode', mode: m })}
              className={`mode-tab ${selected ? 'is-on' : ''}`}
            >
              <Icon width={18} height={18} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div id="mode-panel" role="tabpanel" aria-labelledby={`mode-${state.mode}`} className="mt-6 flex w-full flex-col items-center">
        <PromptCard state={state} dispatch={dispatch} onGenerate={onGenerate} onOpenStyles={() => setStyleOpen(true)} styleChipRef={styleChipRef} />
      </div>

      <div className="mt-10 w-full">
        <SessionsGrid sessions={state.sessions} onOpenHistory={() => onNotify('Generation history is a demo placeholder.')} />
      </div>

      {styleOpen && (
        <StyleModal
          selectedId={state.styleId}
          onSelect={(id) => {
            dispatch({ type: 'setStyle', styleId: id });
            setStyleOpen(false);
          }}
          onClose={() => setStyleOpen(false)}
        />
      )}
    </section>
  );
}
