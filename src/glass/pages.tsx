import { useMemo, useState, type Dispatch } from 'react';
import {
  CATEGORIES, HOME_POPULAR, STYLE_META, getCategory, getTemplate, searchTemplates, templatesIn, type ArtworkTemplate,
} from '../state/catalog';
import { colorsOf, summarize, toJobBrief, type FlowAction, type FlowState } from '../state/flow';
import { IconClose, IconPlus, IconSearch } from '../components/icons';
import { ArtworkTemplateCard, Breadcrumb, CategoryCard, GuidedStepper, rise } from './ui';
import { Thumb } from './Thumb';

export interface PageProps {
  state: FlowState;
  dispatch: Dispatch<FlowAction>;
  onAddReference: () => void;
}

const EMPTY_SEARCH = "Couldn't find an exact match. Describe your idea and Lumora will suggest options.";

function SearchField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="search-field">
      <span className="sr-only">{label}</span>
      <IconSearch width={16} height={16} className="shrink-0 text-[var(--text-muted)]" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function TemplateGrid({ templates, onPick, showCategory, label }: { templates: ArtworkTemplate[]; onPick: (id: string) => void; showCategory?: boolean; label: string }) {
  return (
    <ul aria-label={label} className="card-grid">
      {templates.map((t, i) => (
        <li key={t.id}>
          <ArtworkTemplateCard template={t} index={i} showCategory={showCategory} onPick={() => onPick(t.id)} />
        </li>
      ))}
    </ul>
  );
}

/* ---------- Screen 1: Home ---------- */

export function HomePage({ state, dispatch, onAddReference }: PageProps) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchTemplates(query), [query]);
  const searching = query.trim() !== '';
  const pick = (templateId: string) => dispatch({ type: 'pickTemplate', templateId });
  const hasPrompt = state.brief.prompt.trim() !== '';

  const browse = () => {
    const el = document.getElementById('explore');
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    el?.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true });
  };

  return (
    <>
      <section className="hero">
        <div className="hero-lead">
          <span className="pill"><span className="dot" aria-hidden /> 2D artwork studio · Photoshop + Illustrator</span>
          <h1 id="page-title" tabIndex={-1}>
            What would you like <span className="gradient-phrase">to create?</span>
          </h1>
          <p className="hero-sub">Describe your idea or choose an artwork below. We’ll guide you one easy step at a time.</p>

          <form
            className="glass prompt-box"
            onSubmit={(e) => {
              e.preventDefault();
              dispatch({ type: 'submitPrompt' });
            }}
          >
            <label htmlFor="home-prompt" className="tiny">✦ Describe your idea</label>
            <textarea
              id="home-prompt"
              rows={3}
              value={state.brief.prompt}
              onChange={(e) => dispatch({ type: 'setPrompt', prompt: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  dispatch({ type: 'submitPrompt' });
                }
              }}
              placeholder="e.g. A purple cyberpunk Discord server banner with a dragon…"
            />
            <div className="prompt-bottom">
              <span className="flex min-w-0 items-center gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={onAddReference}>
                  <IconPlus width={14} height={14} /> Add reference
                </button>
                {state.brief.referenceName && (
                  <span className="ref-chip">
                    <span className="truncate">{state.brief.referenceName}</span>
                    <button type="button" aria-label="Remove reference image" onClick={() => dispatch({ type: 'clearReference' })}>
                      <IconClose width={12} height={12} />
                    </button>
                  </span>
                )}
              </span>
              <button type="submit" className="btn btn-primary" disabled={!hasPrompt}>
                Find my artwork <span aria-hidden>↗</span>
              </button>
            </div>
          </form>
          <p className="fine-print">
            No design terms needed.{' '}
            <button type="button" className="link-btn" onClick={browse}>Not sure? Browse artwork ↓</button>
          </p>
        </div>

        <div className="hero-art" aria-hidden>
          <div className="hero-orb" />
          <div className="glass hero-card hero-card-a"><Thumb id="server-banner" className="rounded-[14px]" /></div>
          <div className="glass hero-card hero-card-b"><Thumb id="gaming-avatar" className="rounded-[12px]" /></div>
          <div className="glass hero-card hero-card-c"><Thumb id="static-emotes" className="rounded-[12px]" /></div>
        </div>
      </section>

      <section id="explore" aria-labelledby="explore-title" className="section">
        <div className="section-head">
          <div>
            <h2 id="explore-title">Explore artwork</h2>
            <p>Pick a category, then the artwork. Two clicks.</p>
          </div>
          <SearchField label="Search all artwork" value={query} onChange={setQuery} placeholder="Search all artwork… try “pfp” or “brb”" />
        </div>
        <p className="sr-only" role="status">{searching ? `${results.length} artwork ${results.length === 1 ? 'result' : 'results'}` : ''}</p>
        {!searching ? (
          <ul aria-label="Artwork categories" className="category-grid">
            {CATEGORIES.map((c, i) => (
              <li key={c.id}>
                <CategoryCard category={c} index={i} onOpen={() => dispatch({ type: 'openCategory', categoryId: c.id })} />
              </li>
            ))}
          </ul>
        ) : results.length > 0 ? (
          <TemplateGrid label="Search results" templates={results} onPick={pick} showCategory />
        ) : (
          <p className="glass empty-note">{EMPTY_SEARCH}</p>
        )}
      </section>

      {state.projects.length > 0 && (
        <section aria-labelledby="continue-title" className="section">
          <div className="section-head">
            <div>
              <h2 id="continue-title">Continue creating</h2>
              <p>Pick up a saved brief where you left it.</p>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: 'openProjects' })}>All projects</button>
          </div>
          <ul aria-label="Recent projects" className="card-grid">
            {state.projects.slice(0, 4).map((p, i) => {
              const t = getTemplate(p.brief.templateId);
              if (!t) return null;
              const c = colorsOf(p.brief);
              return (
                <li key={p.id}>
                  <button type="button" className="glass glass-hover template-card rise" style={rise(i)} onClick={() => dispatch({ type: 'resumeProject', id: p.id })}>
                    <Thumb id={t.id} a={c.main} b={c.secondary} className="template-thumb" />
                    <span className="mt-3 block px-1 text-[15px] font-bold text-[var(--text-primary)]">{p.brief.displayName || t.title}</span>
                    <span className="mt-0.5 block px-1 text-[13px] text-[var(--text-secondary)]">{summarize(p.brief)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="popular-title" className="section">
        <div className="section-head">
          <div>
            <h2 id="popular-title">Popular artwork</h2>
            <p>Skip straight to customizing one of these.</p>
          </div>
        </div>
        <TemplateGrid label="Popular artwork" templates={HOME_POPULAR.map((id) => getTemplate(id)!)} onPick={pick} showCategory />
      </section>
    </>
  );
}

/* ---------- Screen 2: Artwork selection ---------- */

export function CategoryPage({ state, dispatch }: PageProps) {
  const category = getCategory(state.categoryId);
  const [query, setQuery] = useState('');
  const all = useMemo(() => templatesIn(category.id), [category.id]);
  const searching = query.trim() !== '';
  const shown = searching ? searchTemplates(query, category.id) : all;

  return (
    <section className="stage">
      <Breadcrumb items={[{ label: 'Home', onClick: () => dispatch({ type: 'goHome' }) }, { label: category.name }]} />
      <GuidedStepper step={1} onJump={(step) => dispatch({ type: 'goToStep', step })} />
      <div className="stage-head">
        <div>
          <p className="tiny">Step 1 · Pick your canvas</p>
          <h1 id="page-title" tabIndex={-1}>Choose your {category.name} artwork</h1>
          <p className="stage-sub">Pick the picture closest to what the client wants. You can change it later.</p>
        </div>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'goHome' })}><span aria-hidden>←</span> Back to categories</button>
      </div>
      <SearchField label={`Search ${category.name} artwork`} value={query} onChange={setQuery} placeholder={`Search ${category.name.toLowerCase()} artwork…`} />
      <p className="sr-only" role="status">{searching ? `${shown.length} artwork ${shown.length === 1 ? 'result' : 'results'}` : ''}</p>
      {shown.length > 0 ? (
        <TemplateGrid label={`${category.name} artwork`} templates={shown} onPick={(templateId) => dispatch({ type: 'pickTemplate', templateId })} />
      ) : (
        <p className="glass empty-note">{EMPTY_SEARCH}</p>
      )}
    </section>
  );
}

/* ---------- Prompt-first: ambiguous idea ---------- */

export function SuggestionsPage({ state, dispatch }: PageProps) {
  const templates = state.suggestionIds.map((id) => getTemplate(id)).filter((t): t is ArtworkTemplate => Boolean(t));
  return (
    <section className="stage">
      <Breadcrumb items={[{ label: 'Home', onClick: () => dispatch({ type: 'goHome' }) }, { label: 'Suggestions' }]} />
      <GuidedStepper step={1} onJump={(step) => dispatch({ type: 'goToStep', step })} />
      <div className="stage-head">
        <div>
          <p className="tiny">Step 1 · We’ll help you choose</p>
          <h1 id="page-title" tabIndex={-1}>Your idea could become…</h1>
          <p className="stage-sub">
            {state.suggestionMatched ? 'Choose what you meant. Your description stays saved.' : `${EMPTY_SEARCH.split('.')[0]}. Here are popular starting points — or browse every category.`}
          </p>
        </div>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'goHome' })}><span aria-hidden>←</span> Edit my idea</button>
      </div>
      <blockquote className="glass idea-quote">“{state.brief.prompt.trim()}”</blockquote>
      <TemplateGrid label="Suggested artwork" templates={templates} onPick={(templateId) => dispatch({ type: 'pickTemplate', templateId })} showCategory />
    </section>
  );
}

/* ---------- Screen 4/5: Brief ready (production not connected) ---------- */

export function ResultPage({ state, dispatch }: PageProps) {
  const t = getTemplate(state.brief.templateId);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle');
  if (!t) return null;
  const category = getCategory(t.categoryId);
  const c = colorsOf(state.brief);
  const job = toJobBrief(state.brief);
  const json = JSON.stringify(job, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied('ok');
    } catch {
      setCopied('failed');
    }
  };

  const rows: [string, string][] = [
    ['Artwork', t.title],
    ['Made in', t.madeIn],
    ['Style', STYLE_META[state.brief.style].name],
    ['Colours', c.name],
    ['Text', state.brief.displayName.trim() || '—'],
    ['Idea', state.brief.prompt.trim() || '—'],
    ['Reference', state.brief.referenceName ? `${state.brief.referenceName} (${state.brief.referenceRole})` : '—'],
    ['Canvas', state.brief.ratio],
    ['Variations', String(state.brief.variations)],
  ];

  return (
    <section className="stage">
      <Breadcrumb
        items={[
          { label: 'Home', onClick: () => dispatch({ type: 'goHome' }) },
          { label: category.name, onClick: () => dispatch({ type: 'openCategory', categoryId: category.id }) },
          { label: t.title, onClick: () => dispatch({ type: 'back' }) },
          { label: 'Create' },
        ]}
      />
      <GuidedStepper step={3} onJump={(step) => dispatch({ type: 'goToStep', step })} />
      <div className="stage-head">
        <div>
          <p className="tiny">Step 3 · Create &amp; refine</p>
          <h1 id="page-title" tabIndex={-1}>Your artwork brief is ready</h1>
          <p className="stage-sub">Send it to production, or keep refining it.</p>
        </div>
      </div>

      <p className="honest-note" role="note">
        <strong>No artwork has been made yet.</strong> The picture below is a direction mockup. Send the brief to production and an agent will draw it in Photoshop and Illustrator.
      </p>

      <div className="result-grid">
        <div className="glass panel">
          <div className="preview-art">
            <span className="mock-badge">Direction mockup · not produced artwork</span>
            <Thumb id={t.id} a={c.main} b={c.secondary} className="rounded-[16px]" />
            {state.brief.displayName.trim() && <span className="preview-name">{state.brief.displayName.trim()}</span>}
          </div>
          <dl className="brief-list">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {t.bundle && (
            <div className="mt-4">
              <p className="form-label">Included in this kit</p>
              <ul className="bundle-list">{t.bundle.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          )}
        </div>

        <div className="glass panel">
          <h2 className="text-[18px] font-bold">What next?</h2>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Choose the art style and send it to be drawn, or change the direction.</p>
          <div className="result-actions">
            <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'openProduce' })}>Send to production <span aria-hidden>↗</span></button>
            <button type="button" className="btn" onClick={copy}>⧉ Copy brief</button>
            <p className="text-[13px] text-[var(--text-secondary)]" role="status">
              {copied === 'ok' && 'Brief copied to the clipboard.'}
              {copied === 'failed' && 'Copying was blocked by the browser — select the brief below and copy it manually.'}
            </p>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'back' })}>✎ Edit artwork brief</button>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'shuffle', seed: Math.floor(Math.random() * 1000) })}>✦ Create variation</button>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'saveProject', id: `p-${Date.now().toString(36)}`, now: Date.now() })}>♡ Save to My Projects</button>
            <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'goHome' })}>＋ Create something new</button>
          </div>
          <details className="advanced mt-4">
            <summary>View brief data</summary>
            <pre className="brief-json" tabIndex={0}>{json}</pre>
          </details>
        </div>
      </div>
    </section>
  );
}

/* ---------- My Projects ---------- */

export function ProjectsPage({ state, dispatch }: PageProps) {
  return (
    <section className="stage">
      <Breadcrumb items={[{ label: 'Home', onClick: () => dispatch({ type: 'goHome' }) }, { label: 'My Projects' }]} />
      <div className="stage-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>My Projects</h1>
          <p className="stage-sub">Briefs saved on this device. No produced artwork is stored here.</p>
        </div>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'goHome' })}>＋ New artwork</button>
      </div>
      {state.projects.length === 0 ? (
        <div className="glass empty-projects">
          <h2 className="text-[20px] font-bold">Nothing saved yet</h2>
          <p>Create an artwork brief, then choose “Save to My Projects” to see it here.</p>
          <button type="button" className="btn btn-primary mt-5" onClick={() => dispatch({ type: 'goHome' })}>Start creating <span aria-hidden>↗</span></button>
        </div>
      ) : (
        <ul aria-label="Saved projects" className="card-grid">
          {state.projects.map((p, i) => {
            const t = getTemplate(p.brief.templateId);
            if (!t) return null;
            const c = colorsOf(p.brief);
            return (
              <li key={p.id} className="glass project-card rise" style={rise(i)}>
                <Thumb id={t.id} a={c.main} b={c.secondary} className="template-thumb" />
                <p className="mt-3 px-1 text-[15px] font-bold">{p.brief.displayName || t.title}</p>
                <p className="mt-0.5 px-1 text-[13px] text-[var(--text-secondary)]">{summarize(p.brief)}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn btn-sm flex-1" onClick={() => dispatch({ type: 'resumeProject', id: p.id })}>Continue editing</button>
                  <button type="button" className="btn btn-sm" aria-label={`Remove ${p.brief.displayName || t.title}`} onClick={() => dispatch({ type: 'removeProject', id: p.id })}>
                    <IconClose width={14} height={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
