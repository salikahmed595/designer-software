import { useEffect, useReducer, useRef } from 'react';
import { GlassHeader } from './glass/ui';
import { CategoryPage, HomePage, ProjectsPage, ResultPage, SuggestionsPage, type PageProps } from './glass/pages';
import { CustomizePage } from './glass/Customize';
import { ProducePage } from './glass/Produce';
import { ToolsPage, useClassicStudio } from './glass/ToolsPage';
import { STORAGE_KEY, flowReducer, loadFlow, serialize } from './state/flow';
import type { Mode } from './state/studio';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_REF_BYTES = 10 * 1024 * 1024;

const storage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

export default function App() {
  const [state, dispatch] = useReducer(flowReducer, undefined, () => loadFlow(storage()));
  const studio = useClassicStudio();
  const fileRef = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  // Save the brief and projects on this device (uploaded references are never stored).
  useEffect(() => {
    try {
      storage()?.setItem(STORAGE_KEY, serialize(state));
    } catch {
      /* storage full or blocked — the app keeps working without persistence */
    }
  }, [state]);

  // On every screen change: back to the top and move focus to the new heading.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById('top')?.scrollIntoView?.({ block: 'start' });
    document.getElementById('page-title')?.focus({ preventScroll: true });
  }, [state.page, state.categoryId, state.brief.templateId]);

  useEffect(() => {
    if (!state.notice) return;
    const t = setTimeout(() => dispatch({ type: 'dismissNotice' }), 6000);
    return () => clearTimeout(t);
  }, [state.notice]);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) return dispatch({ type: 'notify', message: 'Please choose a PNG, JPG or WebP image.' });
    if (file.size > MAX_REF_BYTES) return dispatch({ type: 'notify', message: 'That image is over 10 MB. Please choose a smaller one.' });
    const reader = new FileReader();
    reader.onload = () => dispatch({ type: 'setReference', name: file.name, preview: String(reader.result) });
    reader.onerror = () => dispatch({ type: 'notify', message: 'That image could not be read. Please try another file.' });
    reader.readAsDataURL(file);
  };

  const openTool = (mode: Mode) => {
    studio.dispatch({ type: 'setMode', mode });
    dispatch({ type: 'openTools', mode });
  };

  const props: PageProps = { state, dispatch, onAddReference: () => fileRef.current?.click() };
  const section = state.page === 'projects' ? 'projects' : state.page === 'tools' ? 'tools' : state.page === 'produce' ? 'production' : 'create';

  return (
    <div id="top" className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <GlassHeader
        section={section}
        projectCount={state.projects.length}
        onHome={() => dispatch({ type: 'goHome' })}
        onProjects={() => dispatch({ type: 'openProjects' })}
        onProduce={() => dispatch({ type: 'openProduce' })}
        onTool={openTool}
      />

      <main id="main">
        <div key={`${state.page}-${state.categoryId}-${state.brief.templateId ?? ''}`} className="page-enter">
          {state.page === 'home' && <HomePage {...props} />}
          {state.page === 'category' && <CategoryPage {...props} />}
          {state.page === 'suggestions' && <SuggestionsPage {...props} />}
          {state.page === 'customize' && <CustomizePage {...props} />}
          {state.page === 'result' && <ResultPage {...props} />}
          {state.page === 'projects' && <ProjectsPage {...props} />}
          {state.page === 'produce' && <ProducePage {...props} />}
          {state.page === 'tools' && (
            <ToolsPage studio={studio} onHome={() => dispatch({ type: 'goHome' })} onNotify={(message) => dispatch({ type: 'notify', message })} />
          )}
        </div>
      </main>

      <footer className="endnote">Lumora · 2D artwork studio · Artwork is drawn by an agent in Photoshop and Illustrator on the studio computer.</footer>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload reference image"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div aria-live="polite" className="toast-wrap">
        {state.notice && (
          <div className="toast" role="status">
            <span>{state.notice}</span>
            <button type="button" className="link-btn" onClick={() => dispatch({ type: 'dismissNotice' })}>Dismiss</button>
          </div>
        )}
      </div>
    </div>
  );
}
