import { useRef, useState } from 'react';
import {
  ASPECTS, IMAGE_TYPES, MAX_COUNT, MAX_PROMPT, MIN_COUNT, MODELS, costOf, generateBlockReason,
  type StudioAction, type StudioState,
} from '../state/studio';
import { getStyle } from '../state/styles';
import { Dropdown } from './Dropdown';
import { StyleArt } from './StyleArt';
import { IconBolt, IconClose, IconGrid, IconImage, IconPin, IconPlus, IconRatio, IconSpark } from './icons';

const SHORTCUTS = [
  'Product shot on a seamless studio backdrop',
  'Isometric cozy room, soft morning light',
  'Character turnaround sheet, front / side / back',
  'Flat vector icon set, rounded corners',
];

const COUNTS = Array.from({ length: MAX_COUNT - MIN_COUNT + 1 }, (_, i) => i + MIN_COUNT);
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_REF_BYTES = 10 * 1024 * 1024;

interface PromptCardProps {
  state: StudioState;
  dispatch: (a: StudioAction) => void;
  onGenerate: () => void;
  onOpenStyles: () => void;
  styleChipRef: React.RefObject<HTMLButtonElement>;
}

export function PromptCard({ state, dispatch, onGenerate, onOpenStyles, styleChipRef }: PromptCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [refError, setRefError] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const style = getStyle(state.styleId);
  const cost = costOf(state);
  const blocked = generateBlockReason(state);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) {
      setRefError('Use a PNG, JPG or WebP image.');
      return;
    }
    if (f.size > MAX_REF_BYTES) {
      setRefError('Image must be 10 MB or smaller.');
      return;
    }
    setRefError(null);
    dispatch({ type: 'setReference', name: f.name });
  };

  return (
    <section aria-label="Prompt" className="w-full max-w-[790px] rounded-[22px] border border-white/10 bg-ink-800/80 shadow-[0_20px_60px_-20px_rgba(0,0,0,.6)]">
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md text-[13px] font-medium text-white hover:text-lime-brand focus-ring"
          >
            <IconPlus width={14} height={14} /> Image reference
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-label="Upload image reference"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {state.referenceName && (
            <span className="flex min-w-0 items-center gap-1 rounded-full bg-white/10 py-0.5 pl-2.5 pr-1 text-xs text-neutral-200">
              <span className="truncate">{state.referenceName}</span>
              <button
                type="button"
                aria-label="Remove image reference"
                onClick={() => dispatch({ type: 'setReference', name: null })}
                className="rounded-full p-0.5 hover:bg-white/10 focus-ring"
              >
                <IconClose width={12} height={12} />
              </button>
            </span>
          )}
          {refError && <span role="alert" className="text-xs text-red-400">{refError}</span>}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-white">
          <span id="burst-label">Burst</span>
          <button
            type="button"
            role="switch"
            aria-checked={state.burst}
            aria-labelledby="burst-label"
            title="Burst renders 2× variations per image (doubles credit cost)"
            onClick={() => dispatch({ type: 'toggleBurst' })}
            className={`relative h-[18px] w-[30px] rounded-full transition-colors focus-ring ${state.burst ? 'bg-lime-brand' : 'bg-white/25'}`}
          >
            <span
              className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-transform ${
                state.burst ? 'translate-x-[14px]' : 'translate-x-[2px]'
              }`}
            />
          </button>
        </label>
      </div>

      <div className="rounded-[20px] border border-white/10 bg-ink-850 px-5 pb-3 pt-4">
        <div className="flex gap-3">
          <label htmlFor="prompt" className="sr-only">Describe the image you want to create</label>
          <textarea
            id="prompt"
            rows={2}
            maxLength={MAX_PROMPT}
            value={state.prompt}
            onChange={(e) => dispatch({ type: 'setPrompt', prompt: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onGenerate();
              }
            }}
            placeholder="Describe the image you want to create..."
            aria-describedby="generate-hint"
            className="min-h-[52px] flex-1 resize-none bg-transparent text-[14px] leading-relaxed text-white placeholder:text-neutral-500 focus:outline-none"
          />
          <button
            type="button"
            aria-label="Enhance prompt"
            title="Enhance prompt"
            disabled={state.prompt.trim() === ''}
            onClick={() => dispatch({ type: 'setPrompt', prompt: `${state.prompt.trim()}, highly detailed, balanced composition, soft cinematic lighting` })}
            className="h-9 shrink-0 self-start rounded-full bg-gradient-to-br from-lime-brand to-emerald-500 px-2.5 text-ink-950 transition-opacity disabled:opacity-40 focus-ring"
          >
            <IconSpark width={16} height={16} />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Dropdown
            label="Output type"
            value={state.imageType}
            options={IMAGE_TYPES}
            onChange={(v) => dispatch({ type: 'setImageType', imageType: v })}
            icon={<IconImage width={14} height={14} />}
            className="rounded-full border border-white/10 bg-white/5"
          />

          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={shortcutsOpen}
              onClick={() => setShortcutsOpen((o) => !o)}
              onBlur={(e) => {
                if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setShortcutsOpen(false);
              }}
              className="toolbar-btn"
            >
              <IconPin width={14} height={14} /> Shortcuts
            </button>
            {shortcutsOpen && (
              <ul role="menu" aria-label="Prompt shortcuts" className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-xl border border-white/10 bg-ink-800 p-1 shadow-2xl"
                onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setShortcutsOpen(false); } }}>
                {SHORTCUTS.map((s) => (
                  <li key={s} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        dispatch({ type: 'setPrompt', prompt: s });
                        setShortcutsOpen(false);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-200 hover:bg-white/10 focus-ring"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            ref={styleChipRef}
            type="button"
            onClick={onOpenStyles}
            aria-haspopup="dialog"
            aria-label={`Visual style: ${style.name}`}
            className="toolbar-btn"
          >
            <StyleArt style={style} className="relative h-6 w-6 shrink-0 rounded-full ring-1 ring-white/20" />
            <span className="max-w-[9rem] truncate">{style.name}</span>
          </button>

          <Dropdown
            label="Aspect ratio"
            value={state.aspect}
            options={ASPECTS}
            onChange={(v) => dispatch({ type: 'setAspect', aspect: v })}
            icon={<IconRatio width={14} height={14} />}
            showChevron={false}
          />

          <Dropdown
            label="Number of images"
            value={state.count}
            options={COUNTS}
            onChange={(v) => dispatch({ type: 'setCount', count: v })}
            icon={<IconGrid width={14} height={14} />}
            showChevron={false}
          />

          <div className="ml-auto flex items-center gap-1.5">
            <div className="relative">
              <Dropdown
                label="Model"
                value={state.model}
                options={MODELS}
                onChange={(v) => dispatch({ type: 'setModel', model: v })}
                icon={<IconBolt width={14} height={14} />}
                className="rounded-full border border-white/10 bg-white/5"
              />
              <span className="pointer-events-none absolute -right-1 -top-2.5 rounded-md bg-lime-brand px-1.5 text-[10px] font-semibold leading-4 text-ink-950">
                New
              </span>
            </div>
            <button
              type="button"
              onClick={onGenerate}
              disabled={blocked !== null}
              aria-label={`Generate, costs ${cost} ${cost === 1 ? 'credit' : 'credits'}`}
              className="flex h-9 items-center gap-1.5 rounded-full bg-lime-brand px-4 text-[13px] font-semibold text-ink-950 transition hover:bg-[#a5f57a] disabled:cursor-not-allowed disabled:opacity-40 focus-ring"
            >
              Generate
              <span className="flex items-center gap-0.5" aria-hidden>
                <IconSpark width={12} height={12} />
                {cost}
              </span>
            </button>
          </div>
        </div>
        <p id="generate-hint" className="sr-only" aria-live="polite">
          {blocked ?? `Ready. Generating will use ${cost} of your ${state.credits} credits.`}
        </p>
        {blocked && state.prompt.trim() !== '' && (
          <p className="mt-2 text-right text-xs text-amber-300">{blocked}</p>
        )}
      </div>
    </section>
  );
}
