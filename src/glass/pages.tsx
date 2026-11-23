import { useMemo, useState, type Dispatch } from 'react';
import { CATEGORIES, HOME_POPULAR, getTemplate, searchTemplates, templatesIn, type ArtworkTemplate, type CategoryId } from '../state/catalog';
import type { FlowAction, FlowState } from '../state/flow';
import { IconClose, IconSearch } from '../components/icons';
import { ArtworkCard, GuidedStepper } from './ui';

export interface PageProps {
  state: FlowState;
  dispatch: Dispatch<FlowAction>;
  onAddReference: () => void;
}

type Tab = 'popular' | CategoryId;

/** Step 1 — one screen, one click: pick the artwork the client needs. */
export function HomePage({ state, dispatch }: PageProps) {
  const [tab, setTab] = useState<Tab>('popular');
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';

  const shown: ArtworkTemplate[] = useMemo(() => {
    if (searching) return searchTemplates(query);
    if (tab === 'popular') return HOME_POPULAR.map((id) => getTemplate(id)).filter((t): t is ArtworkTemplate => Boolean(t));
    return templatesIn(tab);
  }, [searching, query, tab]);

  const tabs: { id: Tab; label: string; note?: string; disabled?: boolean }[] = [
    { id: 'popular', label: 'Popular' },
    ...CATEGORIES.map((c) => ({ id: c.id as Tab, label: c.name, disabled: !c.available, note: c.available ? undefined : 'Coming soon' })),
  ];
  const inProgress = getTemplate(state.brief.templateId);

  return (
    <section className="stage">
      <GuidedStepper step={1} onJump={() => undefined} />
      <div className="stage-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>What does the client need?</h1>
          <p className="stage-sub">Pick the artwork. Next you’ll add the style and the client’s brief, and the agent draws it.</p>
        </div>
      </div>

      {inProgress && (state.brief.prompt.trim() !== '' || state.brief.artStyleId) && (
        <p className="glass resume-bar">
          <span>You have an unfinished brief for <strong>{inProgress.title}</strong>.</span>
          <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: 'pickTemplate', templateId: inProgress.id })}>Continue <span aria-hidden>→</span></button>
        </p>
      )}

      <label className="search-field search-big">
        <span className="sr-only">Search artwork</span>
        <IconSearch width={20} height={20} className="shrink-0 text-[var(--text-muted)]" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search — try “overlay”, “emotes”, “logo”, “pfp”…" />
        {searching && (
          <button type="button" className="clear-btn" aria-label="Clear search" onClick={() => setQuery('')}><IconClose width={16} height={16} /></button>
        )}
      </label>

      {!searching && (
        <div role="tablist" aria-label="Artwork categories" className="chip-row">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              disabled={t.disabled}
              className={`chip ${tab === t.id ? 'is-on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.note && <span className="chip-note">{t.note}</span>}
            </button>
          ))}
        </div>
      )}

      <p className="sr-only" role="status">{searching ? `${shown.length} artwork ${shown.length === 1 ? 'result' : 'results'}` : ''}</p>
      {shown.length > 0 ? (
        <ul aria-label={searching ? 'Search results' : 'Artwork'} className="card-grid">
          {shown.map((t, i) => (
            <li key={t.id}>
              <ArtworkCard template={t} index={i} showCategory={searching || tab === 'popular'} onPick={() => dispatch({ type: 'pickTemplate', templateId: t.id })} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="glass empty-box">
          <p className="text-[17px] font-bold">Nothing matches “{query.trim()}”.</p>
          <p>Try a simpler word, or browse the categories.</p>
          <button type="button" className="btn mt-4" onClick={() => setQuery('')}>Show all artwork</button>
        </div>
      )}
    </section>
  );
}
