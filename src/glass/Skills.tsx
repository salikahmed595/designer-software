import { useEffect, useState } from 'react';
import { getCategory, type CategoryId } from '../state/catalog';
import { DEFAULT_SKILL, skillSlots, type SkillSlot, type SkillStatus } from '../state/production';
import type { PageProps } from './pages';

const STATUS_LABEL: Record<SkillStatus, string> = { installed: 'Installed', missing: 'Not installed', unknown: 'Plugin skill' };

/** Asks the bridge which skills exist on this computer; null while checking. */
function useSkillStatuses(): Record<string, SkillStatus> | null {
  const [statuses, setStatuses] = useState<Record<string, SkillStatus> | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/production/skills')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { statuses?: Record<string, SkillStatus> } | null) => alive && setStatuses(body?.statuses ?? {}))
      .catch(() => alive && setStatuses({}));
    return () => {
      alive = false;
    };
  }, []);
  return statuses;
}

function SlotTable({ label, slots, statuses, groupLabel }: { label: string; slots: SkillSlot[]; statuses: Record<string, SkillStatus> | null; groupLabel: (s: SkillSlot) => string }) {
  return (
    <div className="glass panel skills-panel">
      <h2 className="skills-h2">{label}</h2>
      <div className="table-scroll">
        <table className="skills-table" aria-label={label}>
          <thead>
            <tr><th scope="col">Name</th><th scope="col">Section</th><th scope="col">Drawn with</th><th scope="col">On this computer</th></tr>
          </thead>
          <tbody>
            {slots.map((s) => {
              const status = s.skill && statuses ? statuses[s.skill] : undefined;
              return (
                <tr key={s.id} className={status === 'missing' ? 'is-missing' : ''}>
                  <th scope="row">{s.label}</th>
                  <td className="muted">{groupLabel(s)}</td>
                  <td>{s.skill ? <code>{s.skill}</code> : <span className="muted">General skill</span>}</td>
                  <td>
                    {!s.skill ? <span className="muted">—</span>
                      : statuses === null ? <span className="muted">Checking…</span>
                      : status ? <span className={`skill-status is-${status}`}>{STATUS_LABEL[status]}</span>
                      : <span className="muted">Unknown</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Which skill draws each art style and artwork type — for the studio owner, not part of the designer's flow. */
export function SkillsPage({ dispatch }: PageProps) {
  const statuses = useSkillStatuses();
  const slots = skillSlots();
  const styles = slots.filter((s) => s.kind === 'style');
  const artworks = slots.filter((s) => s.kind === 'artwork');
  const dedicated = slots.filter((s) => s.skill).length;
  const missing = statuses ? [...new Set(slots.flatMap((s) => (s.skill && statuses[s.skill] === 'missing' ? [s.skill] : [])))] : [];
  const generalMissing = statuses?.[DEFAULT_SKILL] === 'missing';

  return (
    <section className="stage">
      <div className="stage-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>Skill setup</h1>
          <p className="stage-sub">Which skill draws each art style and artwork type. Designers don’t need to do anything here — they just pick, and the right skill is used.</p>
        </div>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'openJobs' })}><span aria-hidden>← </span>Back to jobs</button>
      </div>

      <div className="skills-summary">
        <p className="glass panel">
          <strong>{dedicated} of {slots.length}</strong> have their own skill. The rest use the general skill <code>{DEFAULT_SKILL}</code>.
          When an art style and an artwork type both have a skill, both are used: the style’s skill decides how it looks, the artwork’s skill decides the layout and what is delivered.
        </p>
        {(missing.length > 0 || generalMissing) && (
          <p className="bridge-note" role="status">
            <span className="dot" aria-hidden />
            {missing.length > 0
              ? `${missing.length} skill${missing.length === 1 ? ' is' : 's are'} not installed on this computer: ${missing.join(', ')}. Jobs that need ${missing.length === 1 ? 'it' : 'them'} can’t be sent until ${missing.length === 1 ? 'it is' : 'they are'} installed.`
              : ''}
            {generalMissing ? ` The general skill ${DEFAULT_SKILL} is not installed either.` : ''}
          </p>
        )}
        <div className="glass panel how-to">
          <p><strong>To give one its own skill:</strong> open <code>production/skills.json</code>, write the skill’s folder name next to the style or artwork (for example <code>"skill": "anime-art"</code>), and save. The app picks it up straight away. Leave it as <code>null</code> to use the general skill.</p>
        </div>
      </div>

      <SlotTable label="Art styles" slots={styles} statuses={statuses} groupLabel={(s) => s.group} />
      <SlotTable label="Artwork types" slots={artworks} statuses={statuses} groupLabel={(s) => getCategory(s.group as CategoryId).name} />
    </section>
  );
}
