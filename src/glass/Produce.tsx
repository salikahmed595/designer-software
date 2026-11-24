import { useCallback, useEffect, useState } from 'react';
import { getTemplate } from '../state/catalog';
import { MAX_BRIEF_CHARS, MAX_TEXT, RATIOS, REF_ROLES } from '../state/flow';
import {
  ART_STYLES, getArtStyle, productionIssues, ratioLabel, skillsFor, type BridgeHealth, type JobView, type SkillRole, type SkillUse,
} from '../state/production';
import { IconCheck, IconClose, IconPlus } from '../components/icons';
import { ChoiceCheck, GuidedStepper, rise } from './ui';
import { Thumb } from './Thumb';
import type { PageProps } from './pages';

const OFFLINE: BridgeHealth = { online: false, runner: 'off', detail: 'Production is offline. Start the studio app with “npm run dev” on the computer that has Photoshop and Illustrator.' };
const STATUS_LABEL: Record<JobView['status'], string> = { queued: 'Waiting', running: 'Drawing…', done: 'Finished', failed: 'Needs attention' };
const ROLE_LABEL: Record<SkillRole, string> = { style: 'Art style', artwork: 'Artwork', general: 'General skill' };

/** Jobs saved before per-job skills had a single "skill" and no file list. */
const jobSkills = (j: JobView & { skill?: string }): SkillUse[] => j.skills ?? (j.skill ? [{ name: j.skill, role: 'style' }] : []);

/** Which skills will draw this job — so the designer can see the dedicated method is being used. */
function DrawnWith({ skills }: { skills: SkillUse[] }) {
  return (
    <div className="drawn-with">
      <p className="drawn-with-title">Drawn with</p>
      <ul aria-label="Drawn with">
        {skills.map((s) => (
          <li key={s.name}>
            <span className="drawn-role">{ROLE_LABEL[s.role]}</span>
            <code>{s.name}</code>
            {s.role === 'general' && <span className="drawn-hint">no dedicated skill yet</span>}
          </li>
        ))}
      </ul>
      <p className="drawn-with-note">You get layered Photoshop / Illustrator files, drawn by hand: every part on its own named layer and text you can still edit.</p>
    </div>
  );
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/production/${path}`, init);
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || body === null) throw new Error(body?.error ?? 'Production did not answer.');
  return body;
}

export interface Bridge {
  health: BridgeHealth | null;
  jobs: JobView[];
  activeJobs: number;
  refresh: () => Promise<void>;
  send: (job: unknown) => Promise<void>;
}

/** Talks to the local production bridge: health once, jobs on a slow poll while any job is active. */
export function useProductionBridge(): Bridge {
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [jobs, setJobs] = useState<JobView[]>([]);

  const refresh = useCallback(async () => {
    try {
      setJobs((await api<{ jobs: JobView[] }>('jobs')).jobs);
    } catch {
      /* keep the last known list; health shows whether production is reachable */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    api<BridgeHealth>('health').then((h) => alive && setHealth(h), () => alive && setHealth(OFFLINE));
    void refresh();
    return () => {
      alive = false;
    };
  }, [refresh]);

  const activeJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'running').length;
  useEffect(() => {
    if (activeJobs === 0) return;
    const t = setInterval(() => void refresh(), 2500);
    return () => clearInterval(t);
  }, [activeJobs, refresh]);

  const send = useCallback(async (job: unknown) => {
    await api('jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job) });
    await refresh();
  }, [refresh]);

  return { health, jobs, activeJobs, refresh, send };
}

/** Shown only when something needs attention; a healthy connection gets a quiet one-line confirmation. */
function BridgeNote({ health }: { health: BridgeHealth | null }) {
  if (health === null) return <p className="bridge-note is-quiet" role="status"><span className="dot" aria-hidden />Checking production…</p>;
  const ok = health.online && health.runner === 'claude';
  return <p className={`bridge-note ${ok ? 'is-ok' : ''}`} role="status"><span className="dot" aria-hidden />{health.detail}</p>;
}

/** Step 2 — everything the agent needs, on one screen. */
export function BriefPage({ state, dispatch, onAddReference, bridge }: PageProps & { bridge: Bridge }) {
  const { brief } = state;
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const template = getTemplate(brief.templateId);
  const style = getArtStyle(brief.artStyleId);
  const tried = state.showErrors;
  const issues = productionIssues({ templateId: brief.templateId, artStyleId: brief.artStyleId, brief: brief.prompt, hasReference: Boolean(brief.referenceName), referenceRole: brief.referenceRole });
  const online = bridge.health?.online === true;
  const canRun = online && bridge.health?.runner !== 'off';
  const briefDone = brief.prompt.trim() !== '';
  const referenceDone = !brief.referenceName || Boolean(brief.referenceRole);

  if (!template) {
    return (
      <section className="stage">
        <div className="glass empty-box">
          <p className="text-[17px] font-bold">Choose an artwork first.</p>
          <button type="button" className="btn btn-primary mt-4" onClick={() => dispatch({ type: 'goHome' })}>Choose artwork</button>
        </div>
      </section>
    );
  }

  const submit = async () => {
    setError(null);
    if (issues.length > 0 || !style) return dispatch({ type: 'showErrors' });
    setSending(true);
    try {
      await bridge.send({
        styleId: style.id,
        ratio: brief.ratio,
        brief: brief.prompt,
        templateId: brief.templateId,
        text: brief.displayName,
        reference: brief.referenceName && state.referencePreview && brief.referenceRole ? { dataUrl: state.referencePreview, role: brief.referenceRole } : null,
      });
      dispatch({ type: 'jobSent' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The job could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const checklist: [string, boolean, string][] = [
    ['Artwork', true, template.title],
    ['Art style', Boolean(style), style?.name ?? 'Not chosen yet'],
    ['Client brief', briefDone, briefDone ? 'Written' : 'Not written yet'],
    ['Reference', referenceDone, brief.referenceName ? (brief.referenceRole ?? 'Say how to use it') : 'None (optional)'],
    ['Size', true, ratioLabel(brief.ratio)],
  ];

  return (
    <section className="stage">
      <GuidedStepper step={2} onJump={() => dispatch({ type: 'goHome' })} />
      <div className="stage-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>Brief for {template.title}</h1>
          <p className="stage-sub">Four quick things, then the agent draws it in Photoshop and Illustrator.</p>
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
          <div className="glass panel" role="group" aria-labelledby="title-style">
            <p id="title-style" className="step-title"><span className={`step-num ${style ? 'is-done' : ''}`} aria-hidden>{style ? <IconCheck width={14} height={14} strokeWidth={3.5} /> : 1}</span> Pick the art style</p>
            <p className="help">How should it look? Each style is drawn with its own method.</p>
            <div role="radiogroup" aria-label="Art style" className="art-style-grid">
              {ART_STYLES.map((s, i) => {
                const on = brief.artStyleId === s.id;
                return (
                  <button key={s.id} type="button" role="radio" aria-checked={on} className={`style-card rise ${on ? 'is-on' : ''}`} style={rise(i)} onClick={() => dispatch({ type: 'setArtStyle', artStyleId: s.id })}>
                    <Thumb id={`style-${s.id}`} a={s.colors[0]} b={s.colors[1]} className="rounded-[12px]" />
                    <span className="mt-2 block text-[15px] font-bold">{s.name}</span>
                    <span className="block text-[13px] leading-snug text-[var(--text-secondary)]">{s.description}</span>
                    {on && <ChoiceCheck />}
                  </button>
                );
              })}
            </div>
            {tried && !style && <p role="alert" className="field-error">Choose an art style.</p>}
          </div>

          <div className="glass panel">
            <label htmlFor="client-brief" className="step-title"><span className={`step-num ${briefDone ? 'is-done' : ''}`} aria-hidden>{briefDone ? <IconCheck width={14} height={14} strokeWidth={3.5} /> : 2}</span> Paste the client’s brief</label>
            <p className="help" id="brief-help">Subject, mood, colours, must-haves and anything to avoid. The client’s own words are fine.</p>
            <textarea
              id="client-brief"
              className="field"
              rows={6}
              maxLength={MAX_BRIEF_CHARS}
              value={brief.prompt}
              onChange={(e) => dispatch({ type: 'setPrompt', prompt: e.target.value })}
              placeholder={`e.g. ${template.promptHint}`}
              aria-invalid={(tried && !briefDone) || undefined}
              aria-describedby={tried && !briefDone ? 'brief-error' : 'brief-help'}
            />
            {tried && !briefDone && <p id="brief-error" role="alert" className="field-error">Write the client brief.</p>}
            <label htmlFor="display-name" className="sub-label">{template.nameLabel} <span className="optional">(optional)</span></label>
            <input id="display-name" className="field" maxLength={MAX_TEXT} value={brief.displayName} onChange={(e) => dispatch({ type: 'setDisplayName', name: e.target.value })} placeholder="e.g. NightWolf" />
          </div>

          <div className="glass panel">
            <p className="step-title"><span className={`step-num ${brief.referenceName && referenceDone ? 'is-done' : ''}`} aria-hidden>{brief.referenceName && referenceDone ? <IconCheck width={14} height={14} strokeWidth={3.5} /> : 3}</span> Add a reference image <span className="optional">(optional)</span></p>
            <p className="help">A photo of the client’s character, a style they like, or a design to edit.</p>
            {!brief.referenceName ? (
              <button type="button" className="reference-box" onClick={onAddReference}>
                <span className="reference-thumb" aria-hidden><IconPlus width={20} height={20} /></span>
                <span>
                  <strong className="block text-[15px]">Choose an image</strong>
                  <span className="text-[13px] text-[var(--text-secondary)]">PNG, JPG or WebP, up to 10 MB</span>
                </span>
              </button>
            ) : (
              <>
                <div className="reference-box is-filled">
                  <span className="reference-thumb">{state.referencePreview ? <img src={state.referencePreview} alt="Client reference" /> : <IconPlus />}</span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{brief.referenceName}</span>
                  <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: 'clearReference' })}><IconClose width={14} height={14} /> Remove</button>
                </div>
                <p className="sub-label" id="role-label">How should the agent use it? <span className="required">Required</span></p>
                <div role="radiogroup" aria-labelledby="role-label" className="pill-row">
                  {REF_ROLES.map((r) => {
                    const on = brief.referenceRole === r;
                    return (
                      <button key={r} type="button" role="radio" aria-checked={on} className={`choice-pill ${on ? 'is-on' : ''}`} onClick={() => dispatch({ type: 'setReferenceRole', role: r })}>
                        {on && <ChoiceCheck />} {r}
                      </button>
                    );
                  })}
                </div>
                {tried && !referenceDone && <p role="alert" className="field-error">Say how the reference image should be used.</p>}
              </>
            )}
          </div>

          <div className="glass panel" role="group" aria-labelledby="title-size">
            <p id="title-size" className="step-title"><span className="step-num is-done" aria-hidden><IconCheck width={14} height={14} strokeWidth={3.5} /></span> Choose the size</p>
            <p className="help">Not sure? Leave it on Auto and the right size for a {template.title.toLowerCase()} is used.</p>
            <div role="radiogroup" aria-label="Size" className="pill-row">
              {RATIOS.map((r) => {
                const on = brief.ratio === r;
                return (
                  <button key={r} type="button" role="radio" aria-checked={on} aria-label={r} className={`choice-pill ${on ? 'is-on' : ''}`} onClick={() => dispatch({ type: 'setRatio', ratio: r })}>
                    {on && <ChoiceCheck />} {ratioLabel(r)}
                  </button>
                );
              })}
            </div>
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
          {template.bundle && (
            <div className="what-you-get">
              <strong>This kit includes:</strong>
              <ul className="bundle-list">{template.bundle.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-big" disabled={sending || !online}>
            {sending ? 'Sending…' : 'Send to production'} <span aria-hidden>→</span>
          </button>
          <p className="next-hint">
            {error ? <span role="alert" className="field-error">{error}</span>
              : tried && issues.length > 0 ? <span className="field-error">{issues.length === 1 ? issues[0] : `${issues.length} things still needed — see the red notes.`}</span>
              : !online ? 'Production is offline, so nothing can be sent yet.'
              : canRun ? 'One job is drawn at a time. You can start the next brief straight away.'
              : 'The job will be saved, but it can’t start until the agent is available.'}
          </p>
          <DrawnWith skills={skillsFor(template.id, style?.id)} />
          {bridge.health !== null && !(online && bridge.health.runner === 'claude') && <BridgeNote health={bridge.health} />}
        </aside>
      </form>
    </section>
  );
}

/** Step 3 — what is being drawn, and the finished artwork. */
export function JobsPage({ dispatch, bridge }: PageProps & { bridge: Bridge }) {
  const { jobs, health, refresh } = bridge;
  return (
    <section className="stage">
      <div className="stage-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>Jobs</h1>
          <p className="stage-sub">Everything sent to production. Finished artwork appears here.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => dispatch({ type: 'openSkills' })}>Skill setup</button>
          <button type="button" className="btn" onClick={() => void refresh()}>Refresh</button>
          <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'goHome' })}><IconPlus width={16} height={16} /> New artwork</button>
        </div>
      </div>
      <BridgeNote health={health} />
      {jobs.length === 0 ? (
        <div className="glass empty-box">
          <p className="text-[17px] font-bold">No jobs yet</p>
          <p>Choose an artwork, fill in the brief and send it. It will show up here.</p>
        </div>
      ) : (
        <ul aria-label="Jobs" className="job-list">
          {jobs.map((j, i) => (
            <li key={j.id} className="glass job-card rise" style={rise(i)} data-status={j.status}>
              <div className="job-main">
                <div className="flex flex-wrap items-center gap-3">
                  <strong className="text-[17px]">{j.templateTitle ?? 'Artwork'}</strong>
                  <span className={`status-pill is-${j.status}`}>{STATUS_LABEL[j.status]}</span>
                </div>
                <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{j.styleName} · {j.ratio}</p>
                <p className="job-brief">“{j.briefExcerpt}”</p>
                {j.message && <p className={`job-message ${j.status === 'failed' ? 'is-failed' : ''}`}>{j.message}</p>}
                {j.status === 'done' && (j.files ?? []).length > 0 && (
                  <div className="job-files">
                    {j.files.includes('artwork.psd') && (
                      <a className="btn btn-sm btn-primary" href={`/api/production/jobs/${j.id}/files/artwork.psd`} download>
                        Download layered PSD{j.layers ? <span className="layer-count"> · {j.layers} layers</span> : null}
                      </a>
                    )}
                    {j.files.includes('artwork.ai') && (
                      <a className="btn btn-sm" href={`/api/production/jobs/${j.id}/files/artwork.ai`} download>Download Illustrator file</a>
                    )}
                  </div>
                )}
                <p className="job-meta">
                  {jobSkills(j).length > 0 && <>Drawn with {jobSkills(j).map((s, k) => <span key={s.name}>{k > 0 && ' + '}<code>{s.name}</code></span>)} · </>}
                  job {j.id}
                </p>
              </div>
              {j.hasPreview && j.runner !== 'mock' && (
                <img className="job-preview" src={`/api/production/jobs/${j.id}/preview`} alt={`Finished artwork: ${j.templateTitle ?? j.styleName}`} loading="lazy" />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
