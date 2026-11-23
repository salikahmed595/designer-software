import { PALETTES, STYLE_META, getCategory, getTemplate } from '../state/catalog';
import {
  MAX_IDEA, MAX_TEXT, MAX_VARIATIONS, RATIOS, REF_ROLES, briefIssues, colorsOf, summarize, type Ratio,
} from '../state/flow';
import { IconClose, IconPlus } from '../components/icons';
import { Breadcrumb, ChoiceCheck, GuidedStepper } from './ui';
import { Thumb } from './Thumb';
import type { PageProps } from './pages';

/** Screen 3 — the essentials first, professional controls collapsed. */
export function CustomizePage({ state, dispatch, onAddReference }: PageProps) {
  const t = getTemplate(state.brief.templateId);
  if (!t) return null;
  const { brief } = state;
  const category = getCategory(t.categoryId);
  const colors = colorsOf(brief);
  const issues = briefIssues(brief);
  const roleMissing = state.showErrors && Boolean(brief.referenceName) && !brief.referenceRole;
  const changeArtwork = () => dispatch({ type: 'openCategory', categoryId: category.id });

  return (
    <section className="stage">
      <Breadcrumb
        items={[
          { label: 'Home', onClick: () => dispatch({ type: 'goHome' }) },
          { label: category.name, onClick: changeArtwork },
          { label: t.title },
        ]}
      />
      <GuidedStepper step={2} onJump={(step) => dispatch({ type: 'goToStep', step })} />
      <div className="stage-head">
        <div>
          <p className="tiny">Step 2 · Make it yours</p>
          <h1 id="page-title" tabIndex={-1}>Customize {t.title}</h1>
          <p className="stage-sub">Change only what matters. Sensible defaults are chosen for everything else.</p>
        </div>
        <button type="button" className="btn" onClick={changeArtwork}><span aria-hidden>←</span> Change artwork</button>
      </div>

      {state.inferred.template && (
        <p className="glass inferred-chip">
          <span>We matched your idea to <strong>{t.title}</strong>.</span>
          <button type="button" className="link-btn" onClick={changeArtwork}>Change</button>
        </p>
      )}
      {t.note && <p className="honest-note" role="note"><strong>What you get:</strong> {t.note}</p>}

      <div className="custom-grid">
        <form
          className="glass panel"
          onSubmit={(e) => {
            e.preventDefault();
            dispatch({ type: 'createBrief' });
          }}
          noValidate
        >
          <fieldset className="form-row">
            <legend className="form-label">1 · Pick a style</legend>
            <div role="radiogroup" aria-label="Style" className="style-grid">
              {t.styles.map((s) => {
                const on = brief.style === s;
                return (
                  <button key={s} type="button" role="radio" aria-checked={on} className={`choice-tile ${on ? 'is-on' : ''}`} onClick={() => dispatch({ type: 'setStyle', style: s })}>
                    <span className="style-swatch" style={{ background: STYLE_META[s].gradient }} aria-hidden>✦</span>
                    <span>{STYLE_META[s].name}</span>
                    {on && <ChoiceCheck />}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="form-row">
            <legend className="form-label">2 · Choose colours</legend>
            {state.inferred.palette && <p className="form-sub">{colors.name} was picked from your description — change it any time.</p>}
            <div className="flex flex-wrap items-center gap-3">
              <div role="radiogroup" aria-label="Colours" className="flex flex-wrap items-center gap-3">
                {PALETTES.map((p) => {
                  const on = !brief.customColor && brief.paletteId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={p.name}
                      title={p.name}
                      className={`swatch ${on ? 'is-on' : ''}`}
                      style={{ background: `linear-gradient(135deg, ${p.main} 50%, ${p.secondary} 51%)` }}
                      onClick={() => dispatch({ type: 'setPalette', paletteId: p.id })}
                    >
                      {on && <ChoiceCheck />}
                    </button>
                  );
                })}
              </div>
              <label className={`custom-color ${brief.customColor ? 'is-on' : ''}`}>
                Custom
                <input type="color" value={brief.customColor ?? colors.main} onChange={(e) => dispatch({ type: 'setCustomColor', color: e.target.value })} aria-label="Custom colour" />
              </label>
            </div>
          </fieldset>

          <div className="form-row">
            <label htmlFor="display-name" className="form-label">3 · {t.nameLabel} <span className="optional">(optional)</span></label>
            <input
              id="display-name"
              className="field"
              maxLength={MAX_TEXT}
              value={brief.displayName}
              onChange={(e) => dispatch({ type: 'setDisplayName', name: e.target.value })}
              placeholder="e.g. NightWolf"
            />
          </div>

          <div className="form-row">
            <label htmlFor="idea" className="form-label">4 · Your idea <span className="optional">(optional)</span></label>
            <textarea
              id="idea"
              className="field"
              rows={3}
              maxLength={MAX_IDEA}
              value={brief.prompt}
              onChange={(e) => dispatch({ type: 'setPrompt', prompt: e.target.value })}
              placeholder={`e.g. ${t.promptHint}`}
            />
          </div>

          <div className="form-row">
            <p className="form-label">Reference image <span className="optional">(optional)</span></p>
            {!brief.referenceName ? (
              <button type="button" className="reference-box" onClick={onAddReference}>
                <span className="reference-thumb" aria-hidden><IconPlus /></span>
                <span>
                  <strong className="block text-[14px]">Add a reference image</strong>
                  <span className="text-[13px] text-[var(--text-secondary)]">A character, a style example or an existing design</span>
                </span>
              </button>
            ) : (
              <div className="reference-box is-filled">
                <span className="reference-thumb">
                  {state.referencePreview ? <img src={state.referencePreview} alt="Your reference" /> : <IconPlus />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{brief.referenceName}</span>
                <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: 'clearReference' })}>
                  <IconClose width={12} height={12} /> Remove
                </button>
              </div>
            )}
            {brief.referenceName && (
              <fieldset className="mt-3">
                <legend className="form-sub" id="role-label">How should we use it? <span className="required">Required</span></legend>
                <div role="radiogroup" aria-labelledby="role-label" aria-invalid={roleMissing || undefined} aria-describedby={roleMissing ? 'role-error' : undefined} className="flex flex-wrap gap-2">
                  {REF_ROLES.map((r) => {
                    const on = brief.referenceRole === r;
                    return (
                      <button key={r} type="button" role="radio" aria-checked={on} className={`choice-pill ${on ? 'is-on' : ''}`} onClick={() => dispatch({ type: 'setReferenceRole', role: r })}>
                        {on && <ChoiceCheck />} {r}
                      </button>
                    );
                  })}
                </div>
                {roleMissing && <p id="role-error" role="alert" className="field-error">Choose how to use your reference image, or remove it.</p>}
              </fieldset>
            )}
          </div>

          {t.bundle && (
            <div className="form-row">
              <p className="form-label">Included in this kit</p>
              <ul className="bundle-list">{t.bundle.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          )}

          <details className="advanced">
            <summary>More options</summary>
            <div className="advanced-inner">
              <label className="block">
                <span className="form-label">Canvas shape</span>
                <select className="field" value={brief.ratio} onChange={(e) => dispatch({ type: 'setRatio', ratio: e.target.value as Ratio })}>
                  {RATIOS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="form-label">Variations</span>
                <select className="field" value={brief.variations} onChange={(e) => dispatch({ type: 'setVariations', count: Number(e.target.value) })}>
                  {Array.from({ length: MAX_VARIATIONS }, (_, i) => <option key={i + 1}>{i + 1}</option>)}
                </select>
              </label>
              <p className="form-sub col-span-full !mb-0">
                Still 2D artwork only. Layered files, transparency and export formats will appear here once the production pipeline reports what it supports.
              </p>
            </div>
          </details>

          <div className="action-bar">
            <p className="summary" aria-label="Summary">{summarize(brief)}</p>
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'back' })}><span aria-hidden>← </span>Back</button>
              <div className="text-right">
                <button type="submit" className="btn btn-primary">Create artwork <span aria-hidden>↗</span></button>
              </div>
            </div>
            <p className="next-hint">
              {state.showErrors && issues.length > 0 ? <span className="field-error">{issues[0]}</span> : 'Next: review the brief that goes to production.'}
            </p>
          </div>
        </form>

        <aside className="glass panel preview-panel" aria-label="Direction preview">
          <div className="flex items-center justify-between gap-3">
            <b className="text-[15px]">Live direction</b>
            <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: 'shuffle', seed: Math.floor(Math.random() * 1000) })}>✦ Surprise me</button>
          </div>
          <div className="preview-art mt-3">
            <span className="mock-badge">Direction mockup · not produced artwork</span>
            <Thumb id={t.id} a={colors.main} b={colors.secondary} className="rounded-[16px]" />
            {brief.displayName.trim() && <span className="preview-name">{brief.displayName.trim()}</span>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pill">{t.title}</span>
            <span className="pill">{STYLE_META[brief.style].name}</span>
            <span className="pill">{colors.name}</span>
            <span className="pill">Made in {t.madeIn}</span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            This preview follows your colours and text so you can agree a direction. It is not the finished artwork.
          </p>
        </aside>
      </div>
    </section>
  );
}
