import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { getCategory, type ArtworkTemplate, type Category } from '../state/catalog';
import { MODES, type Mode } from '../state/studio';
import { IconCheck, IconChevron, IconMenu } from '../components/icons';
import { Thumb } from './Thumb';

const TOOL_LABEL: Record<Mode, string> = { image: 'Image', edit: 'Edit', video: 'Video', music: 'Music', voice: 'Voice', sound: 'Sound', graphic: 'Graphic' };

/** Stagger delay for card entrance animation. */
export const rise = (i: number): CSSProperties => ({ animationDelay: `${Math.min(i, 10) * 45}ms` });

export const Arrow = () => <span aria-hidden className="card-arrow">↗</span>;

/* ---------- Header ---------- */

interface HeaderProps {
  section: 'create' | 'projects' | 'tools' | 'production';
  projectCount: number;
  onHome: () => void;
  onProjects: () => void;
  onProduce: () => void;
  onTool: (mode: Mode) => void;
}

export function GlassHeader({ section, projectCount, onHome, onProjects, onProduce, onTool }: HeaderProps) {
  const [open, setOpen] = useState<'tools' | 'mobile' | null>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (fn: () => void) => () => {
    setOpen(null);
    fn();
  };
  const tools = MODES.map((m) => (
    <button key={m} type="button" role="menuitem" className="menu-item" onClick={go(() => onTool(m))}>
      {TOOL_LABEL[m]}
    </button>
  ));
  const projectsLabel = (
    <>
      My Projects{projectCount > 0 && <span className="count-badge" aria-label={`${projectCount} saved`}>{projectCount}</span>}
    </>
  );

  return (
    <header ref={ref} className="topbar">
      <button type="button" className="brand" onClick={go(onHome)} aria-label="Lumora home">
        <span className="brand-mark" aria-hidden>Λ</span>
        <span>lumora<span className="text-[var(--accent)]">.</span></span>
      </button>

      <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
        <button type="button" className="nav-btn" aria-current={section === 'create' ? 'page' : undefined} onClick={go(onHome)}>Create</button>
        <button type="button" className="nav-btn" aria-current={section === 'projects' ? 'page' : undefined} onClick={go(onProjects)}>{projectsLabel}</button>
        <button type="button" className="nav-btn" aria-current={section === 'production' ? 'page' : undefined} onClick={go(onProduce)}>Production</button>
        <div className="relative">
          <button
            type="button"
            className="nav-btn"
            aria-haspopup="menu"
            aria-expanded={open === 'tools'}
            aria-current={section === 'tools' ? 'page' : undefined}
            onClick={() => setOpen((o) => (o === 'tools' ? null : 'tools'))}
          >
            Tools <IconChevron width={14} height={14} className={`transition-transform ${open === 'tools' ? 'rotate-180' : ''}`} />
          </button>
          {open === 'tools' && (
            <div role="menu" aria-label="Tools" className="menu-panel right-0 w-48">
              <p className="menu-caption">Classic generators</p>
              {tools}
            </div>
          )}
        </div>
      </nav>

      <button
        type="button"
        className="icon-btn md:hidden"
        aria-label={open === 'mobile' ? 'Close menu' : 'Open menu'}
        aria-expanded={open === 'mobile'}
        onClick={() => setOpen((o) => (o === 'mobile' ? null : 'mobile'))}
      >
        <IconMenu width={20} height={20} />
      </button>
      {open === 'mobile' && (
        <div role="menu" aria-label="Menu" className="menu-panel right-0 w-60 md:hidden">
          <button type="button" role="menuitem" className="menu-item" onClick={go(onHome)}>Create</button>
          <button type="button" role="menuitem" className="menu-item" onClick={go(onProjects)}>{projectsLabel}</button>
          <button type="button" role="menuitem" className="menu-item" onClick={go(onProduce)}>Production</button>
          <p className="menu-caption">Tools</p>
          {tools}
        </div>
      )}
    </header>
  );
}

/* ---------- Breadcrumb + Stepper ---------- */

export interface Crumb { label: string; onClick?: () => void }

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((c, i) => (
          <li key={c.label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="opacity-50">›</span>}
            {c.onClick ? (
              <button type="button" className="crumb-btn" onClick={c.onClick}>{c.label}</button>
            ) : (
              <span aria-current="page" className="font-semibold text-[var(--text-primary)]">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const STEPS = ['Choose artwork', 'Customize', 'Create & refine'] as const;

export function GuidedStepper({ step, onJump }: { step: 1 | 2 | 3; onJump: (step: 1 | 2 | 3) => void }) {
  return (
    <div className="stepper-wrap">
      <p className="stepper-compact">Step {step} of 3 · <strong>{STEPS[step - 1]}</strong></p>
      <ol aria-label="Creation progress" className="stepper">
        {STEPS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const state = n === step ? 'on' : n < step ? 'done' : 'todo';
          const inner = (
            <>
              <b aria-hidden>{state === 'done' ? '✓' : n}</b>
              <span>{label}</span>
            </>
          );
          return (
            <li key={label} className={`step step-${state}`} aria-current={state === 'on' ? 'step' : undefined}>
              {i > 0 && <span aria-hidden className="step-line" />}
              {state === 'done' ? (
                <button type="button" className="step-btn" onClick={() => onJump(n)} aria-label={`Go back to step ${n}: ${label}`}>{inner}</button>
              ) : (
                <span className="step-btn">{inner}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------- Cards ---------- */

export function CategoryCard({ category, index, onOpen }: { category: Category; index: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="glass glass-hover category-card rise"
      style={rise(index)}
      onClick={onOpen}
      disabled={!category.available}
      data-category={category.id}
    >
      <Thumb id={category.coverId} className="category-thumb" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-[var(--text-primary)]">{category.name}</span>
        <span className="mt-0.5 block text-[13px] text-[var(--text-secondary)]">{category.subtitle}</span>
        {!category.available && <span className="pill mt-2">{category.unavailableNote}</span>}
      </span>
      {category.available && <Arrow />}
    </button>
  );
}

interface TemplateCardProps {
  template: ArtworkTemplate;
  index: number;
  onPick: () => void;
  /** show the category label (global results, popular, suggestions) */
  showCategory?: boolean;
}

export function ArtworkTemplateCard({ template, index, onPick, showCategory }: TemplateCardProps) {
  return (
    <button type="button" className="glass glass-hover template-card rise" style={rise(index)} onClick={onPick} data-template={template.id}>
      <Thumb id={template.id} className="template-thumb" />
      <span className="mt-3 flex items-start justify-between gap-2 px-1">
        <span className="min-w-0">
          <span className="block text-[15px] font-bold text-[var(--text-primary)]">{template.title}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-[var(--text-secondary)]">{template.subtitle}</span>
        </span>
        <Arrow />
      </span>
      {showCategory && <span className="pill mx-1 mt-2">{getCategory(template.categoryId).name}</span>}
      {template.popular && !showCategory && <span className="pill pill-accent mx-1 mt-2">Popular</span>}
    </button>
  );
}

/** Accessible single-choice tile used by the style and colour pickers. */
export function ChoiceCheck() {
  return (
    <span aria-hidden className="choice-check">
      <IconCheck width={11} height={11} strokeWidth={3.5} />
    </span>
  );
}
