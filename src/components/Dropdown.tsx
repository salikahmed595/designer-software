import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { IconCheck, IconChevron } from './icons';

interface DropdownProps<T extends string | number> {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  icon?: ReactNode;
  badge?: ReactNode;
  showChevron?: boolean;
  className?: string;
  renderValue?: (v: T) => ReactNode;
}

/** Accessible menu-button + listbox. Keyboard: Enter/Space/ArrowDown open, arrows move, Enter selects, Escape closes. */
export function Dropdown<T extends string | number>({
  label, value, options, onChange, icon, badge, showChevron = true, className = '', renderValue,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.indexOf(value)));
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.indexOf(value)));
    listRef.current?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, options, value]);

  const choose = (v: T) => {
    onChange(v);
    setOpen(false);
    btnRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${value}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`toolbar-btn ${className}`}
      >
        {icon}
        <span>{renderValue ? renderValue(value) : value}</span>
        {showChevron && <IconChevron width={14} height={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />}
        {badge}
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              btnRef.current?.focus();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => (a + 1) % options.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => (a - 1 + options.length) % options.length);
            } else if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              choose(options[active]);
            } else if (e.key === 'Tab') {
              setOpen(false);
            }
          }}
          className="absolute bottom-full left-0 z-30 mb-2 min-w-[9rem] rounded-xl border border-white/10 bg-ink-800 p-1 shadow-2xl outline-none"
        >
          {options.map((o, i) => (
            <li
              key={String(o)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o === value}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                i === active ? 'bg-white/10 text-white' : 'text-neutral-300'
              }`}
            >
              {renderValue ? renderValue(o) : o}
              {o === value && <IconCheck width={14} height={14} className="text-lime-brand" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
