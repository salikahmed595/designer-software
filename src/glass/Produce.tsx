import { useCallback, useEffect, useState } from 'react';
import { getTemplate } from '../state/catalog';
import { ENGINES, ENGINE_IDS, type EngineId } from '../state/engines';
import { MAX_BRIEF_CHARS, MAX_TEXT, PICKABLE_REF_ROLES, RATIOS, planStatus } from '../state/flow';
import { parsePlan, type DesignPlan } from '../state/plan';
import { PlanPanel } from './PlanPanel';
import { OrchestratedJob, type Act } from './Orchestration';
import {
  ART_STYLES, HAND_IN, JOB_SHEET, getArtStyle, handInFileIssue, productionIssues, ratioLabel, skillsFor,
  type BridgeHealth, type HandInKind, type HandmadeMode, type JobView, type SkillMap, type SkillRole, type SkillUse,
} from '../state/production';
import { IconCheck, IconClose, IconPlus } from '../components/icons';
import { ChoiceCheck, GuidedStepper, rise } from './ui';
import { Thumb } from './Thumb';
import type { PageProps } from './pages';

const OFFLINE: BridgeHealth = { online: false, runner: 'off', detail: 'Production is offline. Start the studio app with “npm run dev” on the computer that has the drawing apps (Photoshop + Illustrator, or PhotoCraft + VectorCraft).' };
const PLAN_LABEL = { none: 'Not made yet', current: 'Ready to approve', outdated: 'Out of date — plan again' } as const;
const STATUS_LABEL: Record<JobView['status'], string> = { queued: 'Waiting', running: 'Working…', review: 'Your review', done: 'Finished', failed: 'Needs attention' };
const ROLE_LABEL: Record<SkillRole, string> = { orchestration: 'Master flow', style: 'Art style', artwork: 'Artwork', general: 'General skill' };
const HANDMADE_LABEL: Record<HandmadeMode, string> = {
  draw: 'Hand-made — redrawn in Photoshop/Illustrator with manual tools (no AI image generation)',
  strict: 'Hand-made — a designer draws it from the job sheet (no AI)',
  agent: 'Hand-made — a designer draws it (AI-assisted element list)',
};

/** Jobs saved before per-job skills had a single "skill" and no file list. */
const jobSkills = (j: JobView & { skill?: string }): SkillUse[] => j.skills ?? (j.skill ? [{ name: j.skill, role: 'style' }] : []);

/** Which skills will draw this job — so the designer can see the dedicated method is being used. */
export function DrawnWith({ skills, note = 'You get layered Photoshop / Illustrator files, drawn by hand: every part on its own named layer and text you can still edit.' }: { skills: SkillUse[]; note?: string }) {
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
      <p className="drawn-with-note">{note}</p>
    </div>
  );
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
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
  /** Claude reads the brief and returns a design plan (nothing is drawn) */
  plan: (request: unknown) => Promise<DesignPlan>;
  /** hand-made jobs: upload the artwork the designer drew */
  handIn: (id: string, kind: HandInKind, file: File) => Promise<void>;
  /** orchestrated jobs: approve / reject the concept or the final version, resume, cancel */
  act: Act;
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

  const handIn = useCallback(async (id: string, kind: HandInKind, file: File) => {
    await api(`jobs/${id}/hand-in/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
    await refresh();
  }, [refresh]);

  const act = useCallback<Act>(async (id, action, body = {}) => {
    await api(`jobs/${id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    await refresh();
  }, [refresh]);

  const plan = useCallback(async (request: unknown) => {
    const body = await api<{ plan?: unknown }>('plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    const parsed = parsePlan(body.plan);
    if (!parsed.ok) throw new Error(`Claude’s plan was incomplete (${parsed.error}). Try again.`);
    return parsed.plan;
  }, []);

  return { health, jobs, activeJobs, refresh, send, plan, handIn, act };
}

/** Shown only when something needs attention; a healthy connection gets a quiet one-line confirmation. */
export function BridgeNote({ health }: { health: BridgeHealth | null }) {
  if (health === null) return <p className="bridge-note is-quiet" role="status"><span className="dot" aria-hidden />Checking production…</p>;
  const ok = health.online && health.runner === 'claude';
  return <p className={`bridge-note ${ok ? 'is-ok' : ''}`} role="status"><span className="dot" aria-hidden />{health.detail}</p>;
}

/** Step 2 — everything the agent needs, on one screen. */
export function BriefPage({ state, dispatch, onAddReference, bridge, skillMap }: PageProps & { bridge: Bridge; skillMap: SkillMap | null }) {
  const { brief } = state;
  const [sending, setSending] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = planStatus(state);
  const template = getTemplate(brief.templateId);
  const style = getArtStyle(brief.artStyleId);
  const tried = state.showErrors;
  const issues = productionIssues({ templateId: brief.templateId, artStyleId: brief.artStyleId, brief: brief.prompt, hasReference: Boolean(brief.referenceName), referenceRole: brief.referenceRole });
  const online = bridge.health?.online === true;
  const canRun = online && bridge.health?.runner !== 'off';
  /** Claude plans first whenever an agent can run; without one, the job is only saved, so there is no plan step. */
  const canPlan = canRun;
  const briefDone = brief.prompt.trim() !== '';
  const referenceDone = !brief.referenceName || Boolean(brief.referenceRole);
  /** each pair of drawing apps as the bridge sees it (an older bridge says nothing: assume usable) */
  const engineState = (id: EngineId) => bridge.health?.engines?.[id] ?? null;
  const usable = (id: EngineId) => engineState(id)?.ok !== false;
  const engine = ENGINES[brief.engine];
  // The picked apps are not connected but the other pair is: switch, so the designer never starts on a dead choice.
  const pickedUsable = usable(brief.engine);
  const fallback = pickedUsable ? null : ENGINE_IDS.find(usable) ?? null;
  useEffect(() => {
    if (fallback) dispatch({ type: 'setEngine', engine: fallback });
  }, [fallback, dispatch]);

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

  const jobRequest = (styleId: string) => ({
    styleId,
    ratio: brief.ratio,
    brief: brief.prompt,
    templateId: brief.templateId,
    text: brief.displayName,
    engine: brief.engine,
    reference: brief.referenceName && state.referencePreview && brief.referenceRole ? { dataUrl: state.referencePreview, role: brief.referenceRole } : null,
  });

  /** Claude reads the brief (and, on a redo, the designer's note and the current plan) and writes the plan. */
  const makePlan = async (redo?: { note: string; previous: DesignPlan }): Promise<boolean> => {
    setError(null);
    if (issues.length > 0 || !style) {
      dispatch({ type: 'showErrors' });
      return false;
    }
    setPlanning(true);
    try {
      dispatch({ type: 'planReady', plan: await bridge.plan({ ...jobRequest(style.id), ...redo }) });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claude could not make the plan. Try again.');
      return false;
    } finally {
      setPlanning(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (issues.length > 0 || !style) return dispatch({ type: 'showErrors' });
    if (canRun && !pickedUsable) return setError(`${engine.label} is not connected: ${engineState(brief.engine)?.detail ?? ''}`.trim());
    if (canPlan && plan !== 'current') return void makePlan();
    let approved: DesignPlan | null = null;
    if (canPlan && state.plan) {
      const checked = parsePlan(state.plan.plan);
      if (!checked.ok) return setError(`Fix the plan first: ${checked.error}`);
      approved = checked.plan;
    }
    setSending(true);
    try {
      await bridge.send(approved ? { ...jobRequest(style.id), plan: approved } : jobRequest(style.id));
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
    ['Drawing apps', pickedUsable, engine.label],
    ...(canPlan ? [['Design plan', plan === 'current', PLAN_LABEL[plan]] as [string, boolean, string]] : []),
  ];
  const busy = sending || planning;
  const buttonLabel = sending ? 'Sending…' : planning ? 'Claude is planning…' : !canPlan ? 'Send to production' : plan === 'current' ? 'Approve plan and draw' : plan === 'outdated' ? 'Plan with Claude again' : 'Plan with Claude';

  return (
    <section className="stage">
      <GuidedStepper step={2} onJump={() => dispatch({ type: 'goHome' })} />
      <div className="stage-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>Brief for {template.title}</h1>
          <p className="stage-sub">A few quick things. Claude plans the design, you approve it, then it is drawn in {engine.apps.Photoshop} and {engine.apps.Illustrator}.</p>
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
                  {PICKABLE_REF_ROLES.map((r) => {
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

          <div className="glass panel" role="group" aria-labelledby="title-apps">
            <p id="title-apps" className="step-title"><span className={`step-num ${pickedUsable ? 'is-done' : ''}`} aria-hidden>{pickedUsable ? <IconCheck width={14} height={14} strokeWidth={3.5} /> : 5}</span> Draw with</p>
            <p className="help">The apps the agent draws this job in. Both give a layered PSD and an Illustrator file, every part on its own layer.</p>
            <div role="radiogroup" aria-label="Draw with" className="pill-row">
              {ENGINE_IDS.map((id) => {
                const on = brief.engine === id;
                const why = usable(id) ? null : engineState(id)?.detail ?? null;
                return (
                  <button key={id} type="button" role="radio" aria-checked={on} disabled={!usable(id)} className={`choice-pill ${on ? 'is-on' : ''}`} onClick={() => dispatch({ type: 'setEngine', engine: id })}>
                    {on && <ChoiceCheck />} {ENGINES[id].label}
                    {why && <span className="block text-[12px] font-normal text-[var(--text-secondary)]">Not connected: {why}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {canPlan && state.plan && (
            <PlanPanel
              plan={state.plan.plan}
              madeIn={template.madeIn}
              engine={brief.engine}
              outdated={plan === 'outdated'}
              busy={busy}
              onChange={(p) => dispatch({ type: 'editPlan', plan: p })}
              onRedo={(note) => (state.plan ? makePlan({ note, previous: state.plan.plan }) : Promise.resolve(false))}
            />
          )}
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
          <button type="submit" className="btn btn-primary btn-big" disabled={busy || !online}>
            {buttonLabel} <span aria-hidden>→</span>
          </button>
          {planning && <p className="sr-only" role="status">Claude is reading the brief and planning the design. This takes about a minute.</p>}
          <p className="next-hint">
            {error ? <span role="alert" className="field-error">{error}</span>
              : tried && issues.length > 0 ? <span className="field-error">{issues.length === 1 ? issues[0] : `${issues.length} things still needed — see the red notes.`}</span>
              : !online ? 'Production is offline, so nothing can be sent yet.'
              : planning ? 'Claude is reading the brief and planning the design (about a minute).'
              : canPlan && plan === 'current' ? 'Check the plan, change anything, then approve it. One job is drawn at a time.'
              : canPlan ? 'Claude reads the brief and writes a plan first. Nothing is drawn until you approve it.'
              : 'The job will be saved, but it can’t start until the agent is available.'}
          </p>
          {skillMap && <DrawnWith skills={skillsFor(skillMap, template.id, style?.id)} />}
          {bridge.health !== null && !(online && bridge.health.runner === 'claude') && <BridgeNote health={bridge.health} />}
        </aside>
      </form>
    </section>
  );
}

const HAND_IN_LABEL: Record<HandInKind, { upload: string; replace: string; accept: string }> = {
  psd: { upload: 'Upload layered PSD', replace: 'Replace layered PSD', accept: '.psd' },
  ai: { upload: 'Upload Illustrator file', replace: 'Replace Illustrator file', accept: '.ai' },
};

/** Hand-made jobs: the designer uploads what they drew, so the finished files live with the job. */
function HandIn({ job, onHandIn }: { job: JobView; onHandIn: Bridge['handIn'] }) {
  const [busy, setBusy] = useState<HandInKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pick = async (kind: HandInKind, input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const issue = handInFileIssue(kind, file.name, file.size);
    if (issue) return setError(issue);
    setError(null);
    setBusy(kind);
    try {
      await onHandIn(job.id, kind, file);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The upload did not finish. Try again.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="hand-in">
      <p className="hand-in-title">Hand in the finished artwork</p>
      <p className="hand-in-note">
        {job.handedInAt
          ? <>Handed in {new Date(job.handedInAt).toLocaleString()}. Upload again to replace a file.</>
          : 'When the designer has drawn it, upload the layered PSD and/or the Illustrator file here.'}
      </p>
      <div className="hand-in-buttons">
        {(Object.keys(HAND_IN) as HandInKind[]).map((kind) => {
          const label = job.files.includes(HAND_IN[kind]) ? HAND_IN_LABEL[kind].replace : HAND_IN_LABEL[kind].upload;
          return (
            <label key={kind} className={`btn btn-sm ${busy === kind ? 'is-busy' : ''}`}>
              <input type="file" className="sr-only" accept={HAND_IN_LABEL[kind].accept} aria-label={label} disabled={busy !== null} onChange={(e) => void pick(kind, e.currentTarget)} />
              {busy === kind ? 'Uploading…' : label}
            </label>
          );
        })}
      </div>
      {busy && <p className="sr-only" role="status">Uploading…</p>}
      {error && <p className="hand-in-error" role="alert">{error}</p>}
    </div>
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
                {j.orchestration && <OrchestratedJob job={{ ...j, orchestration: j.orchestration }} act={bridge.act} />}
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
                    {j.files.includes(JOB_SHEET) && (
                      <a className="btn btn-sm btn-primary" href={`/api/production/jobs/${j.id}/files/${JOB_SHEET}`} download>Download job sheet</a>
                    )}
                  </div>
                )}
                {j.handmade && j.status === 'done' && <HandIn job={j} onHandIn={bridge.handIn} />}
                <p className="job-meta">
                  {j.handmade && <>{HANDMADE_LABEL[j.handmade]} · </>}
                  {jobSkills(j).length > 0 && <>{j.handmade && j.handmade !== 'draw' ? 'Checklist from' : 'Drawn with'} {jobSkills(j).map((s, k) => <span key={s.name}>{k > 0 && ' + '}<code>{s.name}</code></span>)} · </>}
                  {j.account && <>Ran on {j.account} · </>}
                  job {j.id}
                </p>
              </div>
              {j.hasPreview && j.runner !== 'mock' && j.orchestration?.state !== 'FINAL_REVIEW' && (
                <img className="job-preview" src={`/api/production/jobs/${j.id}/preview`} alt={`Finished artwork: ${j.templateTitle ?? j.styleName}`} loading="lazy" />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
