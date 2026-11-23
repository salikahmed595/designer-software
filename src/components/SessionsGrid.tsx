import type { Session } from '../state/studio';
import { getStyle } from '../state/styles';
import { StyleArt } from './StyleArt';
import { IconClock } from './icons';

function Thumb({ session, index }: { session: Session; index: number }) {
  const style = getStyle(session.styleId);
  // Vary the placeholder per frame so multi-image sessions don't look identical.
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ filter: `hue-rotate(${index * 18}deg)` }}>
      <StyleArt style={style} className="absolute inset-0" />
    </div>
  );
}

export function SessionsGrid({ sessions, onOpenHistory }: { sessions: Session[]; onOpenHistory: () => void }) {
  return (
    <section aria-labelledby="sessions-title" className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="sessions-title" className="text-[15px] font-semibold text-white">Generation sessions</h2>
        <button type="button" onClick={onOpenHistory} className="flex items-center gap-1.5 rounded-md text-[13px] font-medium text-neutral-200 hover:text-white focus-ring">
          <IconClock width={14} height={14} /> Generation history
        </button>
      </div>
      <ul aria-label="Generation sessions" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sessions.map((s) => {
          const frames = Math.min(2, s.count);
          const loading = s.status === 'loading';
          return (
            <li key={s.id} aria-busy={loading} className="group overflow-hidden rounded-xl bg-ink-850 ring-1 ring-white/5">
              <div className={`grid aspect-[3/2] gap-0.5 ${frames === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {Array.from({ length: frames }, (_, i) =>
                  loading ? (
                    <div key={i} className="shimmer relative grid place-items-center bg-ink-800">
                      {i === 0 && <span className="text-xs text-neutral-400">Generating…</span>}
                    </div>
                  ) : (
                    <Thumb key={i} session={s} index={i} />
                  ),
                )}
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <p className="truncate text-[12px] text-neutral-300" title={s.prompt}>{s.prompt}</p>
                <span className="shrink-0 text-[11px] text-neutral-500">
                  {s.count} img · {getStyle(s.styleId).name}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
