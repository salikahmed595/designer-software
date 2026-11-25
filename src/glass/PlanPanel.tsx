import { useEffect, useId, useRef, useState } from 'react';
import type { MadeIn } from '../state/catalog';
import { PLAN_APPS, PLAN_LIMITS, type DesignPlan, type PlanApp } from '../state/plan';
import { IconClose, IconPlus } from '../components/icons';

const VALID_HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const swatch = (hex: string) => {
  const h = hex.trim();
  return VALID_HEX.test(h) ? (h.startsWith('#') ? h : `#${h}`) : 'transparent';
};
const appsFor = (madeIn: MadeIn | undefined): readonly PlanApp[] =>
  madeIn === 'Illustrator' ? ['Illustrator'] : madeIn === 'Photoshop' ? ['Photoshop'] : PLAN_APPS;

interface Props {
  plan: DesignPlan;
  madeIn: MadeIn | undefined;
  outdated: boolean;
  busy: boolean;
  onChange: (plan: DesignPlan) => void;
  /** resolves true when Claude sent back a new plan */
  onRedo: (note: string) => Promise<boolean>;
}

/** Claude's design plan, fully editable: the designer checks it, fixes anything, then approves it. */
export function PlanPanel({ plan, madeIn, outdated, busy, onChange, onRedo }: Props) {
  const id = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [note, setNote] = useState('');
  const apps = appsFor(madeIn);
  const set = <K extends keyof DesignPlan>(key: K, value: DesignPlan[K]) => onChange({ ...plan, [key]: value });
  const lines = (v: string) => v.split('\n').slice(0, PLAN_LIMITS.list);
  const setColour = (i: number, patch: Partial<DesignPlan['palette'][number]>) => set('palette', plan.palette.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const setPart = (i: number, patch: Partial<DesignPlan['parts'][number]>) => set('parts', plan.parts.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, []);

  const text = (key: 'understood' | 'concept' | 'composition' | 'typography', label: string) => (
    <>
      <label htmlFor={`${id}-${key}`} className="sub-label">{label}</label>
      <textarea id={`${id}-${key}`} className="field plan-field" rows={2} maxLength={PLAN_LIMITS.text} value={plan[key]} onChange={(e) => set(key, e.target.value)} />
    </>
  );

  return (
    <section className={`glass panel plan-panel ${outdated ? 'is-outdated' : ''}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} ref={titleRef} tabIndex={-1} className="step-title">Claude’s design plan</h2>
      <p className="help">What Claude understood and how it will be drawn. Change anything, then approve it. Nothing is drawn until you do.</p>
      {outdated && <p className="plan-outdated">You changed the brief after this plan. Plan with Claude again so the plan matches the brief.</p>}
      {plan.styleNote && <p className="plan-style-note"><strong>Claude suggests:</strong> {plan.styleNote}</p>}

      {text('understood', 'What the client wants')}
      {text('concept', 'Concept')}
      {text('composition', 'Composition')}

      <p className="sub-label" id={`${id}-palette`}>Colours</p>
      <ul className="plan-rows" aria-labelledby={`${id}-palette`}>
        {plan.palette.map((c, i) => (
          <li key={i} className="plan-row plan-colour">
            <span className="plan-swatch" aria-hidden style={{ background: swatch(c.hex) }} />
            <input className="field" aria-label={`Colour ${i + 1} name`} maxLength={PLAN_LIMITS.short} value={c.name} onChange={(e) => setColour(i, { name: e.target.value })} />
            <input className="field plan-hex" aria-label={`Colour ${i + 1} hex`} maxLength={7} value={c.hex} aria-invalid={!VALID_HEX.test(c.hex.trim()) || undefined} onChange={(e) => setColour(i, { hex: e.target.value })} />
            <button type="button" className="btn btn-sm plan-remove" aria-label={`Remove colour ${i + 1}`} onClick={() => set('palette', plan.palette.filter((_, k) => k !== i))}><IconClose width={14} height={14} /></button>
          </li>
        ))}
      </ul>
      {plan.palette.length < PLAN_LIMITS.colours && (
        <button type="button" className="btn btn-sm plan-add" onClick={() => set('palette', [...plan.palette, { name: '', hex: '#' }])}><IconPlus width={14} height={14} /> Add colour</button>
      )}

      {text('typography', 'Typography')}

      <p className="sub-label" id={`${id}-parts`}>Parts to draw <span className="optional">(back to front)</span></p>
      <ul className="plan-rows" aria-labelledby={`${id}-parts`}>
        {plan.parts.map((p, i) => (
          <li key={i} className="plan-row plan-part">
            <input className="field" aria-label={`Part ${i + 1} name`} maxLength={PLAN_LIMITS.short} value={p.name} onChange={(e) => setPart(i, { name: e.target.value })} />
            <select className="field" aria-label={`Part ${i + 1} app`} value={p.app} onChange={(e) => setPart(i, { app: e.target.value as PlanApp })}>
              {[...new Set([...apps, p.app])].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <input className="field" aria-label={`Part ${i + 1} detail`} maxLength={PLAN_LIMITS.short * 2} value={p.detail} onChange={(e) => setPart(i, { detail: e.target.value })} />
            <button type="button" className="btn btn-sm plan-remove" aria-label={`Remove part ${i + 1}`} onClick={() => set('parts', plan.parts.filter((_, k) => k !== i))}><IconClose width={14} height={14} /></button>
          </li>
        ))}
      </ul>
      {plan.parts.length < PLAN_LIMITS.parts && (
        <button type="button" className="btn btn-sm plan-add" onClick={() => set('parts', [...plan.parts, { name: '', app: apps[0], detail: '' }])}><IconPlus width={14} height={14} /> Add part</button>
      )}

      <label htmlFor={`${id}-assets`} className="sub-label">Free assets to look for <span className="optional">(one per line)</span></label>
      <textarea id={`${id}-assets`} className="field plan-field" rows={2} value={plan.assets.join('\n')} onChange={(e) => set('assets', lines(e.target.value))} />
      <label htmlFor={`${id}-assumptions`} className="sub-label">Choices Claude made <span className="optional">(one per line)</span></label>
      <textarea id={`${id}-assumptions`} className="field plan-field" rows={2} value={plan.assumptions.join('\n')} onChange={(e) => set('assumptions', lines(e.target.value))} />

      <div className="plan-redo">
        <label htmlFor={`${id}-note`} className="sub-label">What should Claude change?</label>
        <textarea id={`${id}-note`} className="field plan-field" rows={2} maxLength={PLAN_LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Make it warmer, and put the name on top" />
        <button type="button" className="btn mt-3" disabled={busy || note.trim() === ''} onClick={() => void onRedo(note.trim()).then((ok) => ok && setNote(''))}>
          {busy ? 'Claude is planning…' : 'Redo the plan'}
        </button>
      </div>
    </section>
  );
}
