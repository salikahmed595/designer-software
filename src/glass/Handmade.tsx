import { useState } from 'react';
import { getTemplate } from '../state/catalog';
import { MAX_BRIEF_CHARS, MAX_CHANGES, MAX_CHANGE_CHARS, type Changes, type FlowAction } from '../state/flow';
import { NEED_ORIGINAL, productionIssues, skillsFor, type SkillMap } from '../state/production';
import { IconCheck, IconClose, IconPlus } from '../components/icons';
import { GuidedStepper } from './ui';
import { Thumb } from './Thumb';
import { BridgeNote, DrawnWith, type Bridge } from './Produce';
import type { PageProps } from './pages';

/** One editable list: what to add to, or take out of, the client's original. */
function ChangeList({ list, title, inputLabel, button, placeholder, items, dispatch }: {
  list: keyof Changes;
  title: string;
  inputLabel: string;
  button: string;
  placeholder: string;
  items: string[];
  dispatch: (a: FlowAction) => void;
}) {
  const [text, setText] = useState('');
  const full = items.length >= MAX_CHANGES;
  const add = () => {
    if (text.trim() === '' || full) return;
    dispatch({ type: 'addChange', list, text });
    setText('');
  };
  return (
    <div className="change-col">
      <p className="sub-label">{title}</p>
      {items.length > 0 && (
        <ul aria-label={title} className="change-list">
          {items.map((c, i) => (
            <li key={`${i}-${c}`}>
              <span className="min-w-0 flex-1">{c}</span>
              <button type="button" className="change-delete" aria-label={`Delete “${c}”`} onClick={() => dispatch({ type: 'removeChange', list, index: i })}>
                <IconClose width={14} height={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="change-add">
        <input
          className="field"
          aria-label={inputLabel}
          value={text}
          maxLength={MAX_CHANGE_CHARS}
          placeholder={placeholder}
          disabled={full}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn" onClick={add} disabled={full || text.trim() === ''}>{button}</button>
      </div>
    </div>
  );
}

/**
 * Brief for a hand-made job: the client wants their own design, made by a person.
 * No art style or size — the original decides both. The designer lists any approved changes.
 */
export function HandmadeBriefPage({ state, dispatch, onAddReference, bridge, skillMap }: PageProps & { bridge: Bridge; skillMap: SkillMap | null }) {
  const { brief } = state;
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const template = getTemplate(brief.templateId)!;
  const tried = state.showErrors;
  const hasOriginal = Boolean(brief.referenceName && state.referencePreview);
  const issues = productionIssues({ templateId: template.id, artStyleId: null, brief: brief.prompt, hasReference: hasOriginal, referenceRole: null });
  const online = bridge.health?.online === true;
  const noChanges = brief.changes.add.length === 0 && brief.changes.remove.length === 0;
  const notesDone = brief.prompt.trim() !== '';

  const submit = async () => {
    setError(null);
    if (issues.length > 0 || !state.referencePreview) return dispatch({ type: 'showErrors' });
    setSending(true);
    try {
      await bridge.send({
        templateId: template.id,
        brief: brief.prompt,
        handmadeMode: brief.aiSheet ? 'agent' : 'strict',
        changes: brief.changes,
        reference: { dataUrl: state.referencePreview, role: 'Original to redraw' },
      });
      dispatch({ type: 'jobSent' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The job could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const changeCount = brief.changes.add.length + brief.changes.remove.length;
  const checklist: [string, boolean, string][] = [
    ['Artwork', true, template.title],
    ['Original', hasOriginal, hasOriginal ? (brief.referenceName ?? '') : 'Not added yet'],
    ['Changes', true, noChanges ? 'Exact copy' : `${changeCount} approved`],
    ['Client notes', true, notesDone ? 'Written' : 'None (optional)'],
    ['Job sheet', true, brief.aiSheet ? 'AI-assisted list' : 'No AI at all'],
  ];

  return (
    <section className="stage">
      <GuidedStepper step={2} onJump={() => dispatch({ type: 'goHome' })} />
      <div className="stage-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>Brief for {template.title}</h1>
          <p className="stage-sub">The client wants their own design, made by a person. No AI draws any part of it — the app prepares a job sheet and a designer redraws it by hand.</p>
        </div>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'back' })}><span aria-hidden>← </span>Change artwork</button>
      </div>

      <form
        className="brief-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="brief-steps">
          <div className="glass panel">
            <p className="step-title"><span className={`step-num ${hasOriginal ? 'is-done' : ''}`} aria-hidden>{hasOriginal ? <IconCheck width={14} height={14} strokeWidth={3.5} /> : 1}</span> Add the client’s original <span className="required">Required</span></p>
            <p className="help">The exact design to recreate. It is the single source of truth: shapes, text, colours and background stay the same.</p>
            {!brief.referenceName ? (
              <button type="button" className="reference-box" onClick={onAddReference}>
                <span className="reference-thumb" aria-hidden><IconPlus width={20} height={20} /></span>
                <span>
                  <strong className="block text-[15px]">Choose the original image</strong>
                  <span className="text-[13px] text-[var(--text-secondary)]">PNG, JPG or WebP, up to 10 MB</span>
                </span>
              </button>
            ) : (
              <div className="reference-box is-filled">
                <span className="reference-thumb">{state.referencePreview ? <img src={state.referencePreview} alt="Client’s original" /> : <IconPlus />}</span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{brief.referenceName}</span>
                <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: 'clearReference' })}><IconClose width={14} height={14} /> Remove</button>
              </div>
            )}
            {tried && !hasOriginal && <p role="alert" className="field-error">{NEED_ORIGINAL}</p>}
          </div>

          <div className="glass panel" role="group" aria-labelledby="title-changes">
            <p id="title-changes" className="step-title"><span className="step-num is-done" aria-hidden><IconCheck width={14} height={14} strokeWidth={3.5} /></span> Changes from the original <span className="optional">(optional)</span></p>
            <p className="help">Leave both lists empty for an exact copy. Only list what the client approved — everything else stays as it is.</p>
            {noChanges && <p className="exact-copy">None — an exact copy of the original.</p>}
            <div className="change-grid">
              <ChangeList list="add" title="Add to the design" inputLabel="Something to add" button="Add" placeholder="e.g. A sixth star on the top row" items={brief.changes.add} dispatch={dispatch} />
              <ChangeList list="remove" title="Take out of the design" inputLabel="Something to take out" button="Take out" placeholder="e.g. The small tagline" items={brief.changes.remove} dispatch={dispatch} />
            </div>
          </div>

          <div className="glass panel">
            <label htmlFor="client-brief" className="step-title"><span className="step-num is-done" aria-hidden><IconCheck width={14} height={14} strokeWidth={3.5} /></span> Paste the client’s notes <span className="optional">(optional)</span></label>
            <p className="help">Anything the client said about the original: sizes, file formats, deadline.</p>
            <textarea id="client-brief" className="field" rows={4} maxLength={MAX_BRIEF_CHARS} value={brief.prompt} onChange={(e) => dispatch({ type: 'setPrompt', prompt: e.target.value })} placeholder={`e.g. ${template.promptHint}`} />
          </div>

          <div className="glass panel">
            <label className="ai-sheet">
              <input type="checkbox" checked={brief.aiSheet} onChange={(e) => dispatch({ type: 'setAiSheet', on: e.target.checked })} />
              <span>
                <strong className="block text-[15px]">Let the agent write a detailed element list</strong>
                <span className="text-[14px] text-[var(--text-secondary)]">
                  {brief.aiSheet
                    ? 'AI-assisted: the agent looks at the original and lists every element for the designer. It never draws and has no Photoshop or Illustrator tools — but only use this if the client allows AI for planning, and tell them.'
                    : 'Off: no AI is used for this job at all. The job sheet is made from the hand-made skill and your notes.'}
                </span>
              </span>
            </label>
          </div>
        </div>

        <aside className="glass panel summary-panel" aria-label="Your job">
          <Thumb id={template.id} className="rounded-[14px]" />
          <ul className="checklist" aria-label="Checklist">
            {checklist.map(([label, done, value]) => (
              <li key={label} className={done ? 'is-done' : ''}>
                <span className="check-dot" aria-hidden>{done && <IconCheck width={12} height={12} strokeWidth={3.5} />}</span>
                <span className="check-label">{label}</span>
                <span className="check-value">{value}</span>
              </li>
            ))}
          </ul>
          {template.note && <p className="what-you-get"><strong>What you get:</strong> {template.note}</p>}
          <button type="submit" className="btn btn-primary btn-big" disabled={sending || !online}>
            {sending ? 'Sending…' : 'Send to production'} <span aria-hidden>→</span>
          </button>
          <p className="next-hint">
            {error ? <span role="alert" className="field-error">{error}</span>
              : tried && issues.length > 0 ? <span className="field-error">{issues[0]}</span>
              : !online ? 'Production is offline, so nothing can be sent yet.'
              : brief.aiSheet ? 'The agent writes the element list; then a designer draws it by hand.'
              : 'The job sheet is ready straight away for the designer who draws it.'}
          </p>
          {skillMap && (
            <DrawnWith
              skills={skillsFor(skillMap, template.id, null)}
              note="A designer draws it by hand, layer by layer, from the job sheet. The skill is the checklist they follow — it never draws."
            />
          )}
          {bridge.health !== null && !online && <BridgeNote health={bridge.health} />}
        </aside>
      </form>
    </section>
  );
}
