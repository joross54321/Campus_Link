import React, { useEffect, useId, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  filterAndRankSuggestions,
  highlightParts,
  suggestionQueryValue,
  type SearchSuggestion,
} from '../lib/searchSuggestions';

export type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  suggestions: SearchSuggestion[];
  onSelectSuggestion?: (suggestion: SearchSuggestion) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
  inputClassName?: string;
  maxSuggestions?: number;
  minChars?: number;
};

export default function SearchField({
  value,
  onChange,
  suggestions,
  onSelectSuggestion,
  onSubmit,
  placeholder = 'Search…',
  loading = false,
  className,
  inputClassName,
  maxSuggestions = 8,
  minChars = 1,
}: SearchFieldProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const ranked = filterAndRankSuggestions(suggestions, value, maxSuggestions);
  const showList =
    open && value.trim().length >= minChars && (ranked.length > 0 || loading);

  useEffect(() => {
    setActiveIndex(-1);
  }, [value, ranked.length]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (s: SearchSuggestion) => {
    onChange(suggestionQueryValue(s));
    onSelectSuggestion?.(s);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList && e.key === 'ArrowDown' && ranked.length > 0) {
      setOpen(true);
      setActiveIndex(0);
      e.preventDefault();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i < ranked.length - 1 ? i + 1 : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? ranked.length - 1 : i - 1));
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && ranked[activeIndex]) {
        pick(ranked[activeIndex]);
      } else {
        onSubmit?.(value);
        setOpen(false);
      }
    }
  };

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <div
        className={cn(
          'flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 w-full transition-all',
          open && 'border-brand-gold/40 bg-white ring-2 ring-brand-gold/10',
          inputClassName
        )}
      >
        <Search size={16} className="text-slate-300 shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          role="combobox"
          autoComplete="off"
          className="bg-transparent border-none outline-none text-sm w-full text-brand-ink placeholder:text-slate-300"
        />
        {loading && (
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
            …
          </span>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden py-2 max-h-72 overflow-y-auto"
        >
          {loading && ranked.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-400">Loading suggestions…</li>
          )}
          {!loading && ranked.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-400">No matches</li>
          )}
          {ranked.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className={cn(
                  'w-full px-4 py-3 text-left transition-colors flex flex-col gap-0.5',
                  i === activeIndex ? 'bg-brand-gold/10' : 'hover:bg-slate-50'
                )}
              >
                <span className="text-sm font-bold text-brand-blue">
                  {highlightParts(s.label, value).map((p, idx) =>
                    p.match ? (
                      <mark
                        key={idx}
                        className="bg-brand-gold/30 text-brand-blue rounded-sm px-0.5"
                      >
                        {p.text}
                      </mark>
                    ) : (
                      <span key={idx}>{p.text}</span>
                    )
                  )}
                </span>
                {s.hint && (
                  <span className="text-[10px] text-slate-400 font-medium truncate">
                    {s.hint}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
