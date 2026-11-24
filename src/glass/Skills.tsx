import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCategory, type CategoryId } from '../state/catalog';
import {
  ART_STYLES, MAX_SKILL_FILE_CHARS, parseSkillFile, referencedSkills, skillSlots, skillStatus,
  type SkillChange, type SkillSlot, type SkillsState,
} from '../state/production';
import { TEMPLATES } from '../state/catalog';
import { api } from './Produce';
import type { PageProps } from './pages';

/* ---------- talking to the bridge ---------- */

/** Where a newly added skill should be used straight away (optional). */
export type UseFor = { kind: 'default' } | { kind: 'style' | 'artwork'; id: string };

export interface SkillsApi {
  /** null while loading, or when production can't be reached */
  data: SkillsState | null;
  error: string | null;
  reload: () => Promise<void>;
  change: (c: SkillChange) => Promise<void>;
  add: (content: string, useFor?: UseFor) => Promise<{ added: string; note: string | null }>;
}

const postJson = <T,>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** The skill map and the skills on this computer — shared by the brief and the Skills screen. */
export function useSkills(): SkillsApi {
  const [data, setData] = useState<SkillsState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await api<SkillsState>('skills'));
      setError(null);
    } catch {
      setError('Production is offline, so skills can’t be shown. Start the studio app with “npm run dev”.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const change = useCallback(async (c: SkillChange) => {
    setData(await postJson<SkillsState>('skills/assign', c));
  }, []);

  const add = useCallback(async (content: string, useFor?: UseFor) => {
    const body = await postJson<SkillsState & { added: string; note?: string | null }>('skills/add', useFor ? { content, useFor } : { content });
    setData({ map: body.map, installed: body.installed, fileError: body.fileError });
    return { added: body.added, note: body.note ?? null };
  }, []);

  return { data, error, reload, change, add };
}

/* ---------- pieces ---------- */

const DEFAULT_VALUE = '';

/** Installed skills, plus the current one if it isn't installed (so the choice is never hidden). */
function skillOptions(installed: string[], current: string | null): string[] {
  return current && !installed.includes(current) ? [...installed, current] : installed;
}

function SlotTable({ label, empty, slots, groupLabel, data, busy, onPick }: {
  label: string;
  empty: string;
  slots: SkillSlot[];
  groupLabel: (s: SkillSlot) => string;
  data: SkillsState;
  busy: string | null;
  onPick: (slot: SkillSlot, skill: string | null) => void;
}) {
  const installed = data.installed.map((s) => s.name);
  const have = new Set(installed);
  return (
    <div className="glass panel skills-panel">
      <h2 className="skills-h2">{label}</h2>
      {slots.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="table-scroll">
          <table className="skills-table" aria-label={label}>
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Section</th><th scope="col">Drawn with</th></tr>
            </thead>
            <tbody>
              {slots.map((s) => {
                const missing = s.skill !== null && skillStatus(s.skill, have) === 'missing';
                return (
                  <tr key={s.id} className={missing ? 'is-missing' : ''}>
                    <th scope="row">{s.label}</th>
                    <td className="muted">{groupLabel(s)}</td>
                    <td>
                      <div className="skill-cell">
                        <select
                          className="field skill-select"
                          aria-label={`Skill for ${s.label}`}
                          value={s.skill ?? DEFAULT_VALUE}
                          disabled={busy === `${s.kind}:${s.id}`}
                          onChange={(e) => onPick(s, e.target.value === DEFAULT_VALUE ? null : e.target.value)}
                        >
                          <option value={DEFAULT_VALUE}>{s.fallback === data.map.defaultSkill ? `Default skill (${s.fallback})` : `Hand-made skill (${s.fallback})`}</option>
                          {skillOptions(installed, s.skill).map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                        {missing && <span className="skill-status is-missing">Not installed</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Upload or paste a SKILL.md, see what it is, optionally use it for something, add it. */
function AddSkill({ skills, notify }: { skills: SkillsApi; notify: (m: string) => void }) {
  const [text, setText] = useState('');
  const [useFor, setUseFor] = useState('');
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const parsed = text.trim() === '' ? null : parseSkillFile(text);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setServerError(null);
    if (file.size > MAX_SKILL_FILE_CHARS * 4) return setServerError('This file is too large for a skill. Choose the skill’s SKILL.md.');
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.onerror = () => setServerError('That file could not be read. Please try again.');
    reader.readAsText(file);
  };

  const submit = async () => {
    if (!parsed?.ok || busy) return;
    setBusy(true);
    setServerError(null);
    const [kind, id] = useFor.split(':');
    const target: UseFor | undefined = useFor === 'default' ? { kind: 'default' }
      : kind === 'style' || kind === 'artwork' ? { kind, id } : undefined;
    try {
      const { added, note } = await skills.add(text, target);
      const label = !target ? '' : target.kind === 'default' ? ' It is now the default skill.'
        : ` ${(target.kind === 'style' ? ART_STYLES.find((s) => s.id === target.id)?.name : TEMPLATES.find((t) => t.id === target.id)?.title) ?? ''} now uses it.`;
      notify(`Added “${added}”.${note ? ` ${note}` : label}`);
      setText('');
      setUseFor('');
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'The skill could not be added.');
    } finally {
      setBusy(false);
    }
  };

  const problem = serverError ?? (parsed && !parsed.ok ? parsed.error : null);

  return (
    <section className="glass panel add-skill" aria-labelledby="add-skill-title">
      <h2 id="add-skill-title" className="skills-h2">Add a skill</h2>
      <p className="muted">A skill is a folder with a <code>SKILL.md</code> file that tells the agent how to draw. Add yours here and it is installed on this computer, ready to pick below.</p>

      <div className="add-skill-grid">
        <div className="add-skill-input">
          <label className="sub-label" htmlFor="skill-file">1. Choose the SKILL.md file</label>
          <input
            ref={fileRef}
            id="skill-file"
            type="file"
            accept=".md,text/markdown,text/plain"
            className="skill-file"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <label className="sub-label" htmlFor="skill-text">…or paste the SKILL.md text</label>
          <textarea
            id="skill-text"
            className="field skill-text"
            rows={6}
            spellCheck={false}
            placeholder={'---\nname: manga-effects\ndescription: Black-and-white manga inks with screentone.\n---\n\nHow to draw it…'}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setServerError(null);
            }}
          />
        </div>

        <div className="add-skill-side">
          {problem ? (
            <p role="alert" className="field-error">{problem}</p>
          ) : parsed?.ok ? (
            <div className="skill-preview">
              <p>Ready to add <code>{parsed.name}</code></p>
              <p className="muted">{parsed.description}</p>
            </div>
          ) : (
            <p className="muted">Choose or paste a skill to see its name and what it does.</p>
          )}

          <label className="sub-label" htmlFor="skill-use-for">2. Use it for (optional)</label>
          <select id="skill-use-for" className="field skill-select" value={useFor} onChange={(e) => setUseFor(e.target.value)}>
            <option value="">Nothing yet — just add it</option>
            <option value="default">The default skill (everything without its own)</option>
            <optgroup label="Art styles">
              {ART_STYLES.map((s) => <option key={s.id} value={`style:${s.id}`}>{s.name}</option>)}
            </optgroup>
            <optgroup label="Artwork types">
              {TEMPLATES.map((t) => <option key={t.id} value={`artwork:${t.id}`}>{t.title}</option>)}
            </optgroup>
          </select>

          <button type="button" className="btn btn-primary" disabled={!parsed?.ok || busy} onClick={() => void submit()}>
            {busy ? 'Adding…' : 'Add skill'}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------- the screen ---------- */

const matches = (s: SkillSlot, group: string, q: string) => `${s.label} ${group} ${s.skill ?? ''}`.toLowerCase().includes(q);
const artworkGroup = (s: SkillSlot) => getCategory(s.group as CategoryId).name;

/** Add skills, choose the default skill, and pick which skill draws each art style and artwork type. */
export function SkillsPage({ dispatch, skills }: PageProps & { skills: SkillsApi }) {
  const { data, error } = skills;
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const notify = useCallback((message: string) => dispatch({ type: 'notify', message }), [dispatch]);

  const slots = useMemo(() => (data ? skillSlots(data.map) : []), [data]);
  const q = query.trim().toLowerCase();
  const styles = slots.filter((s) => s.kind === 'style' && (q === '' || matches(s, s.group, q)));
  const artworks = slots.filter((s) => s.kind === 'artwork' && (q === '' || matches(s, artworkGroup(s), q)));

  const apply = async (key: string, change: SkillChange, done: string) => {
    setBusy(key);
    try {
      await skills.change(change);
      notify(done);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'That change could not be saved.');
    } finally {
      setBusy(null);
    }
  };

  const onPick = (slot: SkillSlot, skill: string | null) =>
    void apply(`${slot.kind}:${slot.id}`, { kind: slot.kind, id: slot.id, skill }, `${slot.label} now uses ${skill ?? 'the default skill'}.`);

  if (!data) {
    return (
      <section className="stage">
        <div className="stage-head"><div><h1 id="page-title" tabIndex={-1}>Skills</h1></div></div>
        <p className="bridge-note" role="status"><span className="dot" aria-hidden />{error ?? 'Loading skills…'}</p>
        {error && <button type="button" className="btn" onClick={() => void skills.reload()}>Try again</button>}
      </section>
    );
  }

  const installed = data.installed.map((s) => s.name);
  const have = new Set(installed);
  const missing = referencedSkills(data.map).filter((name) => skillStatus(name, have) === 'missing');
  const dedicated = slots.filter((s) => s.skill).length;
  const defaultInfo = data.installed.find((s) => s.name === data.map.defaultSkill);

  return (
    <section className="stage">
      <div className="stage-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>Skills</h1>
          <p className="stage-sub">Add your own skills and choose which one draws each art style and artwork type. Changes are saved straight away and used for the next job.</p>
        </div>
      </div>

      {data.fileError && <p className="bridge-note" role="status"><span className="dot" aria-hidden />{data.fileError}</p>}
      {missing.length > 0 && (
        <p className="bridge-note" role="status">
          <span className="dot" aria-hidden />
          {`${missing.length} skill${missing.length === 1 ? ' is' : 's are'} not installed on this computer: ${missing.join(', ')}. Jobs that use ${missing.length === 1 ? 'it' : 'them'} can’t be sent until ${missing.length === 1 ? 'it is' : 'they are'} added — add ${missing.length === 1 ? 'it' : 'them'} below, or pick another skill.`}
        </p>
      )}

      <div className="glass panel default-skill">
        <div>
          <h2 className="skills-h2"><label htmlFor="default-skill">Default skill</label></h2>
          <p className="muted">
            Used for every art style and artwork type set to “Default skill” ({slots.length - dedicated} of {slots.length} right now).
            When a style and an artwork type both have their own skill, both are used: the style’s decides the look, the artwork’s decides the layout and files.
          </p>
          {defaultInfo?.description && <p className="muted default-skill-about">{defaultInfo.description}</p>}
        </div>
        <select
          id="default-skill"
          className="field skill-select"
          value={data.map.defaultSkill}
          disabled={busy === 'default'}
          onChange={(e) => void apply('default', { kind: 'default', skill: e.target.value }, `Default skill is now ${e.target.value}.`)}
        >
          {skillOptions(installed, data.map.defaultSkill).map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      <AddSkill skills={skills} notify={notify} />

      <div className="skills-search">
        <input
          type="search"
          className="field"
          aria-label="Find a style or artwork"
          placeholder="Find a style or artwork…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <SlotTable label="Art styles" empty="No art styles match." slots={styles} groupLabel={(s) => s.group} data={data} busy={busy} onPick={onPick} />
      <SlotTable label="Artwork types" empty="No artwork types match." slots={artworks} groupLabel={artworkGroup} data={data} busy={busy} onPick={onPick} />
    </section>
  );
}
