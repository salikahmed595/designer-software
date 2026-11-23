import { useCallback, useEffect, useMemo, useState } from 'react';
import { CATEGORIES, getTemplate, templatesIn } from '../state/catalog';
import { RATIOS, REF_ROLES } from '../state/flow';
import {
  ART_STYLE_TABS, MAX_BRIEF, filterArtStyles, getArtStyle, productionIssues, ratioLabel, skillFor,
  type BridgeHealth, type JobView,
} from '../state/production';
import { IconClose, IconPlus, IconSearch } from '../components/icons';
import { Breadcrumb, ChoiceCheck, rise } from './ui';
import { Thumb } from './Thumb';
import type { PageProps } from './pages';

const OFFLINE: BridgeHealth = { online: false, runner: 'off', detail: 'The production bridge is offline. Start the studio app with “npm run dev” on the computer that has Photoshop and Illustrator.' };
const STATUS_LABEL: Record<JobView['status'], string> = { queued: 'Waiting', running: 'Drawing…', done: 'Finished', failed: 'Needs attention' };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/production/${path}`, init);
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || body === null) throw new Error(body?.error ?? 'The production bridge did not answer.');
  return body;
}

/** Talks to the local bridge: health once, jobs on a slow poll while any job is active. */
function useProductionBridge() {
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [jobs, setJobs] = useState<JobView[]>([]);

  const refresh = useCallback(async () => {
    try {
      setJobs((await api<{ jobs: JobView[] }>('jobs')).jobs);
    } catch {
      /* keep the last known list; health shows the bridge state */
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

  const active = jobs.some((j) => j.status === 'queued' || j.status === 'running');
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void refresh(), 2500);
    return () => clearInterval(t);
  }, [active, refresh]);

  return { health, jobs, refresh };
}

/** Sub-page: choose the art style, give the client brief + reference + ratio, and send it to the agent. */
export function ProducePage({ state, dispatch, onAddReference }: PageProps) {
  const { brief } = state;
  const { health, jobs, refresh } = useProductionBridge();
  const [tab, setTab] = useState('All');
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const styles = useMemo(() => filterArtStyles(query, tab), [query, tab]);
  const style = getArtStyle(brief.artStyleId);
  const template = getTemplate(brief.templateId);
  const issues = productionIssues({ artStyleId: brief.artStyleId, brief: brief.prompt, hasReference: Boolean(brief.referenceName), referenceRole: brief.referenceRole });
  const canRun = health?.online === true && health.runner !== 'off';
  const roleMissing = tried && Boolean(brief.referenceName) && !brief.referenceRole;

  const submit = async () => {
    setTried(true);
    setError(null);
    if (issues.length > 0 || !style || !health?.online) return;
    setSending(true);
    try {
      await api('jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleId: style.id,
          ratio: brief.ratio,
          brief: brief.prompt,
          templateId: brief.templateId,
          text: brief.displayName,
          reference: brief.referenceName && state.referencePreview && brief.referenceRole ? { dataUrl: state.referencePreview, role: brief.referenceRole } : null,
        }),
      });
      setTried(false);
      await refresh();
      document.getElementById('jobs-title')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The job could not be sent.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="stage">
      <Breadcrumb items={[{ label: 'Home', onClick: () => dispatch({ type: 'goHome' }) }, { label: 'Production' }]} />
      <div className="stage-head">
        <div>
          <p className="tiny">Production · Photoshop + Illustrator</p>
          <h1 id="page-title" tabIndex={-1}>Send to production</h1>
          <p className="stage-sub">Pick the art style, paste the client’s brief, add their reference and choose the ratio. The agent does the drawing.</p>
        </div>
      </div>

      <p className={`bridge-note ${health?.online && health.runner === 'claude' ? 'is-ok' : ''}`} role="status">
        <span className="dot" aria-hidden />
        {health === null ? 'Checking the production bridge…' : health.detail}
      </p>

      <form
        className="produce-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="glass panel">
          <fieldset className="form-row">
            <legend className="form-label">1 · Art style <span className="required">Required</span></legend>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div role="tablist" aria-label="Art style categories" className="flex flex-wrap gap-1">
                {ART_STYLE_TABS.map((t) => (
                  <button key={t} type="button" role="tab" aria-selected={t === tab} className={`tab-pill ${t === tab ? 'is-on' : ''}`} onClick={() => setTab(t)}>{t}</button>
                ))}
              </div>
              <label className="search-field !mb-0 ml-auto !max-w-[220px]">
                <span className="sr-only">Search art styles</span>
                <IconSearch width={15} height={15} className="shrink-0 text-[var(--text-muted)]" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search styles" />
              </label>
            </div>
            {styles.length === 0 ? (
              <p className="empty-note">No art style matches “{query.trim()}”.</p>
            ) : (
              <div role="radiogroup" aria-label="Art style" className="art-style-grid">
                {styles.map((s, i) => {
                  const on = brief.artStyleId === s.id;
                  return (
                    <button key={s.id} type="button" role="radio" aria-checked={on} className={`style-card rise ${on ? 'is-on' : ''}`} style={rise(i)} onClick={() => dispatch({ type: 'setArtStyle', artStyleId: s.id })}>
                      <Thumb id={`style-${s.id}`} a={s.colors[0]} b={s.colors[1]} className="rounded-[12px]" />
                      <span className="mt-2 block text-[14px] font-bold">{s.name}</span>
                      <span className="block text-[12px] leading-snug text-[var(--text-secondary)]">{s.description}</span>
                      {on && <ChoiceCheck />}
                    </button>
                  );
                })}
              </div>
            )}
            {tried && !style && <p role="alert" className="field-error">Choose an art style.</p>}
            {style && (
              <p className="skill-line">
                Skill used: <code>{skillFor(style.id)}</code>
                {style.skill === null && <span> — the general skill, until you add one for {style.name} in <code>production/styles.json</code>.</span>}
              </p>
            )}
          </fieldset>

          <div className="form-row">
            <label htmlFor="client-brief" className="form-label">2 · Client brief <span className="required">Required</span></label>
            <textarea
              id="client-brief"
              className="field"
              rows={5}
              maxLength={MAX_BRIEF}
              value={brief.prompt}
              onChange={(e) => dispatch({ type: 'setPrompt', prompt: e.target.value })}
              placeholder="Paste what the client asked for: subject, mood, colours, must-haves, things to avoid…"
              aria-invalid={(tried && brief.prompt.trim() === '') || undefined}
              aria-describedby={tried && brief.prompt.trim() === '' ? 'brief-error' : undefined}
            />
            {tried && brief.prompt.trim() === '' && <p id="brief-error" role="alert" className="field-error">Write the client brief.</p>}
          </div>

          <div className="form-row">
            <p className="form-label">3 · Reference image <span className="optional">(optional)</span></p>
            {!brief.referenceName ? (
              <button type="button" className="reference-box" onClick={onAddReference}>
                <span className="reference-thumb" aria-hidden><IconPlus /></span>
                <span>
                  <strong className="block text-[14px]">Add the client’s reference</strong>
                  <span className="text-[13px] text-[var(--text-secondary)]">PNG, JPG or WebP, up to 10 MB</span>
                </span>
              </button>
            ) : (
              <div className="reference-box is-filled">
                <span className="reference-thumb">{state.referencePreview ? <img src={state.referencePreview} alt="Client reference" /> : <IconPlus />}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{brief.referenceName}</span>
                <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: 'clearReference' })}><IconClose width={12} height={12} /> Remove</button>
              </div>
            )}
            {brief.referenceName && (
              <fieldset className="mt-3">
                <legend className="form-sub" id="produce-role-label">How should the agent use it? <span className="required">Required</span></legend>
                <div role="radiogroup" aria-labelledby="produce-role-label" className="flex flex-wrap gap-2">
                  {REF_ROLES.map((r) => {
                    const on = brief.referenceRole === r;
                    return (
                      <button key={r} type="button" role="radio" aria-checked={on} className={`choice-pill ${on ? 'is-on' : ''}`} onClick={() => dispatch({ type: 'setReferenceRole', role: r })}>
                        {on && <ChoiceCheck />} {r}
                      </button>
                    );
                  })}
                </div>
                {roleMissing && <p role="alert" className="field-error">Say how the reference image should be used.</p>}
              </fieldset>
            )}
          </div>

          <fieldset className="form-row">
            <legend className="form-label">4 · Ratio</legend>
            <div role="radiogroup" aria-label="Ratio" className="flex flex-wrap gap-2">
              {RATIOS.map((r) => {
                const on = brief.ratio === r;
                return (
                  <button key={r} type="button" role="radio" aria-checked={on} aria-label={r} className={`choice-pill ${on ? 'is-on' : ''}`} onClick={() => dispatch({ type: 'setRatio', ratio: r })}>
                    {on && <ChoiceCheck />} {ratioLabel(r)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <details className="advanced">
            <summary>More options</summary>
            <div className="advanced-inner">
              <label className="block">
                <span className="form-label">Artwork type</span>
                <select className="field" value={brief.templateId ?? ''} onChange={(e) => dispatch({ type: 'setArtworkType', templateId: e.target.value || null })}>
                  <option value="">Not set — follow the brief</option>
                  {CATEGORIES.filter((c) => c.available).map((c) => (
                    <optgroup key={c.id} label={c.name}>
                      {templatesIn(c.id).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="form-label">Name or text on the artwork</span>
                <input className="field" maxLength={60} value={brief.displayName} onChange={(e) => dispatch({ type: 'setDisplayName', name: e.target.value })} placeholder="e.g. NightWolf" />
              </label>
            </div>
          </details>

          <div className="action-bar">
            <p className="summary" aria-label="Job summary">
              {[style?.name ?? 'No style yet', template?.title, ratioLabel(brief.ratio)].filter(Boolean).join(' · ')}
            </p>
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'back' })}><span aria-hidden>← </span>Back</button>
              <button type="submit" className="btn btn-primary" disabled={sending || health?.online !== true}>
                {sending ? 'Sending…' : 'Send to production'} <span aria-hidden>↗</span>
              </button>
            </div>
            <p className="next-hint">
              {error ? <span role="alert" className="field-error">{error}</span>
                : tried && issues.length > 0 ? <span className="field-error">{issues[0]}</span>
                : canRun ? 'Next: the agent opens Photoshop / Illustrator on this computer and draws it. One job runs at a time.'
                : 'The job will be saved, but it cannot start until the agent is available.'}
            </p>
          </div>
        </div>

        <aside className="glass panel" aria-labelledby="jobs-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="jobs-title">Production jobs</h2>
            <button type="button" className="btn btn-sm" onClick={() => void refresh()}>Refresh</button>
          </div>
          {jobs.length === 0 ? (
            <p className="mt-4 text-[14px] text-[var(--text-secondary)]">No jobs yet. Sent jobs appear here with their status and the finished preview.</p>
          ) : (
            <ul aria-label="Production jobs" className="job-list">
              {jobs.map((j) => (
                <li key={j.id} className="job-card" data-status={j.status}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-[14px]">{j.styleName}{j.templateTitle ? ` · ${j.templateTitle}` : ''}</strong>
                    <span className={`status-pill is-${j.status}`}>{STATUS_LABEL[j.status]}</span>
                  </div>
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)]">“{j.briefExcerpt}”</p>
                  <p className="mt-1 text-[12px] text-[var(--text-muted)]">Skill <code>{j.skill}</code> · {j.ratio} · job {j.id}</p>
                  {j.hasPreview && j.runner !== 'mock' && <img className="job-preview" src={`/api/production/jobs/${j.id}/preview`} alt={`Finished artwork preview: ${j.styleName}`} loading="lazy" />}
                  {j.message && <p className={`mt-2 text-[13px] ${j.status === 'failed' ? 'text-[var(--danger)]' : 'text-[var(--text-secondary)]'}`}>{j.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </form>
    </section>
  );
}
