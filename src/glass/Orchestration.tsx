/**
 * One orchestrated job on the Jobs screen: Brief → Concept → Production → Review → Delivery.
 * The designer approves or rejects the concept and the final version here; nothing else needs a click.
 * Every status shown comes from the server's record (files and verdicts), never from a simulated progress bar.
 */
import { useState } from 'react';
import {
  STAGES, STAGE_LABEL, type JobState, type Orchestration, type StageStatus,
} from '../state/orchestration';
import type { JobView } from '../state/production';
import { appFor, engineOf } from '../state/engines';

export type JobAction = 'concept/approve' | 'concept/reject' | 'final/approve' | 'final/reject' | 'resume' | 'cancel';
export type Act = (id: string, action: JobAction, body?: Record<string, unknown>) => Promise<void>;

const PHASES = ['Brief', 'Concept', 'Production', 'Review', 'Delivery'] as const;
const PHASE_OF: Record<JobState, number> = {
  BRIEF_PENDING: 0, ART_DIRECTION_READY: 0, CONCEPT_GENERATING: 1, CONCEPT_QA: 1, CONCEPT_REVIEW: 1, CONCEPT_APPROVED: 2, ASSET_PLANNING: 2,
  PRODUCTION: 2, STAGE_VERIFYING: 2, STAGE_CORRECTING: 2, HUMAN_INTERVENTION_REQUIRED: -1, ASSEMBLY: 3, FINAL_QA: 3, FINAL_REVIEW: 3,
  EXPORTING: 4, DELIVERED: 4, CANCELLED: -1,
};
export const STATE_LABEL: Record<JobState, string> = {
  BRIEF_PENDING: 'Brief received', ART_DIRECTION_READY: 'Art direction ready', CONCEPT_GENERATING: 'Making the concept', CONCEPT_QA: 'Checking the concept',
  CONCEPT_REVIEW: 'Concept ready for your review', CONCEPT_APPROVED: 'Concept approved', ASSET_PLANNING: 'Planning assets', PRODUCTION: 'Drawing',
  STAGE_VERIFYING: 'Verifying stages', STAGE_CORRECTING: 'Correcting', HUMAN_INTERVENTION_REQUIRED: 'Needs you', ASSEMBLY: 'Assembling',
  FINAL_QA: 'Final checks', FINAL_REVIEW: 'Final artwork ready for your review', EXPORTING: 'Exporting', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
};
const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  pending: 'Pending', executing: 'Drawing', verifying: 'Verifying', correcting: 'Correcting', passed: 'Passed',
  not_applicable_verified: 'Not needed (verified)', blocked: 'Blocked', invalidated: 'Redo',
};

function Feedback({ label, button, onSend }: { label: string; button: string; onSend: (text: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const id = `fb-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <form className="orch-feedback" onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 3) void onSend(text.trim()).then(() => setText('')); }}>
      <label htmlFor={id} className="orch-label">{label}</label>
      <textarea id={id} className="field" rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit" className="btn btn-sm" disabled={text.trim().length < 3}>{button}</button>
    </form>
  );
}

export function OrchestratedJob({ job, act }: { job: JobView & { orchestration: Orchestration }; act: Act }) {
  const o = job.orchestration;
  const engine = engineOf(job.engine);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: JobAction, body?: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await act(job.id, action, body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };
  const latest = o.concept.versions[o.concept.versions.length - 1];
  const locked = o.concept.locked ? o.concept.versions.find((v) => v.version === o.concept.locked?.version) : undefined;
  const phase = PHASE_OF[o.state];
  const finished = o.state === 'DELIVERED' || o.state === 'CANCELLED';

  return (
    <div className="orch" aria-busy={busy}>
      <ol className="orch-phases" aria-label="Progress">
        {PHASES.map((p, i) => (
          <li key={p} className={phase > i || o.state === 'DELIVERED' ? 'is-done' : phase === i ? 'is-now' : ''} aria-current={phase === i ? 'step' : undefined}>{p}</li>
        ))}
      </ol>
      <p className="orch-state"><strong>{STATE_LABEL[o.state]}</strong>{o.productionRuns > 0 && <> · production run {o.productionRuns}</>}</p>

      {o.state === 'CONCEPT_REVIEW' && latest && (
        <section className="orch-review" aria-label="Concept review">
          <img className="orch-concept" src={`/api/production/jobs/${job.id}/concepts/${latest.version}`} alt={`AI concept version ${latest.version}`} />
          <p className="orch-note">Concept v{latest.version} — made by AI as a <strong>reference only</strong>. It is never placed, traced or painted over: the artwork is drawn from scratch in {engine.apps.Photoshop} / {engine.apps.Illustrator} after you approve.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void run('concept/approve', { version: latest.version })}>Approve concept v{latest.version}</button>
          </div>
          <Feedback label="What should change in the concept?" button="Make a new concept" onSend={(feedback) => run('concept/reject', { feedback })} />
        </section>
      )}

      {o.state === 'HUMAN_INTERVENTION_REQUIRED' && (
        <section className="orch-blocker" aria-label="Needs you">
          <p role="alert">{o.blocker}</p>
          <Feedback label="Note for the next attempt (optional)" button="Resume" onSend={(feedback) => run('resume', { feedback })} />
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run('resume', {})}>Resume without a note</button>
        </section>
      )}

      {o.state === 'FINAL_REVIEW' && o.finalCandidate && (
        <section className="orch-review" aria-label="Final review">
          <img className="orch-concept" src={`/api/production/jobs/${job.id}/preview?v=${o.finalCandidate.version.slice(0, 12)}`} alt="Finished artwork preview" />
          <p className="orch-note">Version <code>{o.finalCandidate.version.slice(0, 12)}</code> — files: {o.finalCandidate.files.map((f) => f.name).join(', ')}. Only this exact version is exported.</p>
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void run('final/approve', { version: o.finalCandidate?.version })}>Approve this version</button>
          <Feedback label="What should change?" button="Send back for correction" onSend={(feedback) => run('final/reject', { feedback })} />
        </section>
      )}

      {error && <p className="field-error" role="alert">{error}</p>}

      {locked && <p className="orch-note">Approved concept: v{locked.version} · <code>{locked.sha256.slice(0, 12)}</code></p>}

      {o.registry.length > 0 && (
        <details className="orch-details" open={!finished}>
          <summary>Assets and stages ({o.registry.length})</summary>
          <div className="orch-table-wrap">
            <table className="orch-table">
              <thead>
                <tr><th scope="col">Asset</th>{STAGES.map((s) => <th key={s} scope="col">{STAGE_LABEL[s]}</th>)}</tr>
              </thead>
              <tbody>
                {o.registry.map((a) => (
                  <tr key={a.id}>
                    <th scope="row">{a.name}<span className="orch-app">{appFor(engine.id, a.app)}</span></th>
                    {STAGES.map((s) => {
                      const st = a.stages[s];
                      const where = [st.checkpoint ? `checkpoint ${st.checkpoint.file}` : null, ...st.evidence.map((e) => `evidence ${e}`), st.reason, ...st.defects].filter(Boolean).join('\n');
                      return (
                        <td key={s} className={`stage is-${st.status}`} title={where || undefined}>
                          {STAGE_STATUS_LABEL[st.status]}{st.attempt > 0 && <span className="orch-attempt"> · try {st.attempt + 1}</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="orch-evidence" aria-label="Checkpoints and evidence">
            {o.registry.flatMap((a) => STAGES.filter((s) => a.stages[s].checkpoint || a.stages[s].evidence.length || a.stages[s].defects.length).map((s) => {
              const st = a.stages[s];
              return (
                <li key={`${a.id}-${s}`}>
                  <strong>{a.name} · {STAGE_LABEL[s]}</strong>
                  {st.checkpoint && <> — checkpoint <code>{st.checkpoint.file}</code></>}
                  {st.evidence.map((e) => <span key={e}> — evidence <code>{e}</code></span>)}
                  {st.defects.length > 0 && <> — findings: {st.defects.join('; ')}</>}
                </li>
              );
            }))}
          </ul>
        </details>
      )}

      <details className="orch-details">
        <summary>History ({o.history.length})</summary>
        <ol className="orch-history">
          {o.history.map((t, i) => (
            <li key={i}><time dateTime={new Date(t.at).toISOString()}>{new Date(t.at).toLocaleTimeString()}</time> {STATE_LABEL[t.to]} <span className="orch-actor">({t.actor})</span> — {t.reason}</li>
          ))}
        </ol>
      </details>

      {!finished && (
        <button type="button" className="btn btn-sm orch-cancel" disabled={busy} onClick={() => { if (window.confirm('Cancel this job? The agent is stopped and nothing more is drawn.')) void run('cancel'); }}>Cancel job</button>
      )}
    </div>
  );
}
