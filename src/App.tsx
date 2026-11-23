import { useEffect, useReducer, useRef } from 'react';
import { GlassHeader } from './glass/ui';
import { HomePage, type PageProps } from './glass/pages';
import { BriefPage, JobsPage, useProductionBridge } from './glass/Produce';
import { STORAGE_KEY, flowReducer, loadFlow, serialize } from './state/flow';

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
  const bridge = useProductionBridge();
  const fileRef = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  // Keep the unfinished brief on this device (the uploaded reference image is never stored).
  useEffect(() => {
    try {
      storage()?.setItem(STORAGE_KEY, serialize(state));
    } catch {
      /* storage full or blocked — the app keeps working without it */
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
  }, [state.page, state.brief.templateId]);

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

  const props: PageProps = { state, dispatch, onAddReference: () => fileRef.current?.click() };

  return (
    <div id="top" className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <GlassHeader page={state.page} activeJobs={bridge.activeJobs} onHome={() => dispatch({ type: 'goHome' })} onJobs={() => dispatch({ type: 'openJobs' })} />

      <main id="main">
        <div key={`${state.page}-${state.brief.templateId ?? ''}`} className="page-enter">
          {state.page === 'home' && <HomePage {...props} />}
          {state.page === 'brief' && <BriefPage {...props} bridge={bridge} />}
          {state.page === 'jobs' && <JobsPage {...props} bridge={bridge} />}
        </div>
      </main>

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
