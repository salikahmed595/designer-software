import { useEffect, useMemo, useRef, useState } from 'react';
import { STYLES, STYLE_CATEGORIES, filterStyles, type StyleCategory } from '../state/styles';
import { StyleArt } from './StyleArt';
import { IconClose, IconSearch } from './icons';

interface StyleModalProps {
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function StyleModal({ selectedId, onSelect, onClose }: StyleModalProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<StyleCategory>('All');
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => filterStyles(STYLES, query, category), [query, category]);

  useEffect(() => {
    searchRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Escape to close + simple focus trap.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onTabsKey = (e: React.KeyboardEvent) => {
    const i = STYLE_CATEGORIES.indexOf(category);
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % STYLE_CATEGORIES.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + STYLE_CATEGORIES.length) % STYLE_CATEGORIES.length;
    else return;
    e.preventDefault();
    setCategory(STYLE_CATEGORIES[next]);
    dialogRef.current?.querySelector<HTMLElement>(`[data-cat="${STYLE_CATEGORIES[next]}"]`)?.focus();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 p-3 pt-6 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="style-modal-title"
        onKeyDown={onKeyDown}
        className="animate-pop flex max-h-[calc(100vh-3rem)] w-full max-w-[862px] flex-col rounded-2xl border border-white/10 bg-ink-850 shadow-2xl"
      >
        <div className="flex flex-wrap items-center gap-3 px-5 pb-2 pt-5">
          <h2 id="style-modal-title" className="mr-auto text-[17px] font-semibold text-white">
            Apply visual style
          </h2>
          <label className="relative order-3 w-full sm:order-none sm:w-[230px]">
            <span className="sr-only">Search styles</span>
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" width={14} height={14} />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-full rounded-full border border-white/15 bg-transparent pl-9 pr-3 text-sm text-white placeholder:text-neutral-500 focus:border-lime-brand/60 focus:outline-none focus:ring-2 focus:ring-lime-brand/30"
              placeholder="Search"
            />
          </label>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-ring"
          >
            <IconClose width={14} height={14} />
          </button>
        </div>

        <div role="tablist" aria-label="Style categories" onKeyDown={onTabsKey} className="scrollbar-none flex gap-1 overflow-x-auto px-5 py-2">
          {STYLE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              data-cat={c}
              aria-selected={c === category}
              tabIndex={c === category ? 0 : -1}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-[13px] font-medium focus-ring ${
                c === category ? 'bg-white/10 text-white' : 'text-neutral-300 hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="scrollbar-thin min-h-[200px] overflow-y-auto px-5 pb-5 pt-2">
          {results.length === 0 ? (
            <p className="py-16 text-center text-sm text-neutral-400" role="status">
              No styles match “{query.trim()}”{category !== 'All' ? ` in ${category}` : ''}.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {results.map((s) => {
                const selected = s.id === selectedId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(s.id)}
                      aria-pressed={selected}
                      aria-label={s.name}
                      className={`group relative block aspect-square w-full overflow-hidden rounded-xl text-left focus-ring ${
                        selected ? 'ring-2 ring-lime-brand' : 'ring-1 ring-white/5 hover:ring-white/30'
                      }`}
                    >
                      <StyleArt style={s} className="absolute inset-0 transition-transform duration-300 group-hover:scale-105" />
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 text-[12px] font-medium text-white">
                        {s.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
