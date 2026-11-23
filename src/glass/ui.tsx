import type { CSSProperties } from 'react';
import { getCategory, type ArtworkTemplate } from '../state/catalog';
import type { Page } from '../state/flow';
import { IconCheck } from '../components/icons';
import { Thumb } from './Thumb';

/** Stagger delay for the card entrance animation. */
export const rise = (i: number): CSSProperties => ({ animationDelay: `${Math.min(i, 10) * 40}ms` });

/* ---------- Header: two destinations, nothing else ---------- */

interface HeaderProps {
  page: Page;
  /** jobs waiting or being drawn right now */
  activeJobs: number;
  onHome: () => void;
  onJobs: () => void;
}

export function GlassHeader({ page, activeJobs, onHome, onJobs }: HeaderProps) {
  return (
    <header className="topbar">
      <button type="button" className="brand" onClick={onHome} aria-label="Lumora home">
        <span className="brand-mark" aria-hidden>Λ</span>
        <span className="brand-name">lumora<span className="text-[var(--accent)]">.</span></span>
      </button>
      <nav aria-label="Primary" className="flex items-center gap-1">
        <button type="button" className="nav-btn" aria-current={page !== 'jobs' ? 'page' : undefined} onClick={onHome}>New artwork</button>
        <button type="button" className="nav-btn" aria-current={page === 'jobs' ? 'page' : undefined} onClick={onJobs}>
          Jobs
          {activeJobs > 0 && <span className="count-badge" aria-label={`${activeJobs} in progress`}>{activeJobs}</span>}
        </button>
      </nav>
    </header>
  );
}

/* ---------- Stepper ---------- */

const STEPS = ['Choose artwork', 'Brief', 'Result'] as const;

export function GuidedStepper({ step, onJump }: { step: 1 | 2 | 3; onJump: (step: 1 | 2 | 3) => void }) {
  return (
    <div className="stepper-wrap">
      <p className="stepper-compact">Step {step} of 3 · <strong>{STEPS[step - 1]}</strong></p>
      <ol aria-label="Progress" className="stepper">
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

export function ArtworkCard({ template, index, onPick, showCategory }: { template: ArtworkTemplate; index: number; onPick: () => void; showCategory?: boolean }) {
  return (
    <button type="button" className="glass glass-hover artwork-card rise" style={rise(index)} onClick={onPick} data-template={template.id}>
      <Thumb id={template.id} className="artwork-thumb" />
      <span className="artwork-title">{template.title}</span>
      <span className="artwork-sub">{template.subtitle}</span>
      {showCategory && <span className="pill mt-2">{getCategory(template.categoryId).name}</span>}
    </button>
  );
}

export function ChoiceCheck() {
  return (
    <span aria-hidden className="choice-check">
      <IconCheck width={12} height={12} strokeWidth={3.5} />
    </span>
  );
}
