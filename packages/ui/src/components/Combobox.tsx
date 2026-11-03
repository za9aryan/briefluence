'use client';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '../lib/cn';
import { Icon } from '../primitives/Icon';

export interface ComboOption {
  value: string;
  label: string;
  /** Second line, e.g. the region of a city. */
  hint?: string;
}

interface BaseProps {
  id?: string;
  options: ComboOption[];
  placeholder?: string;
  /** Shown when nothing matches. */
  emptyLabel: string;
  removeLabel: string;
  /** Server search: called (debounced) with what the user types; then `options` are its results. */
  onQueryChange?: (q: string) => void;
  loading?: boolean;
  /** Label for a chosen value that is not in `options` (e.g. a city from an earlier search). */
  labelOf?: (value: string) => string;
  invalid?: boolean;
  disabled?: boolean;
  'aria-describedby'?: string;
  className?: string;
}

type Props = BaseProps &
  (
    | { multiple: true; value: string[]; onChange: (v: string[]) => void }
    | { multiple?: false; value: string | null; onChange: (v: string | null) => void }
  );

const norm = (s: string) => s.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Searchable select: type to filter, arrows + Enter to pick, Esc to close. One value or several
 * (chips with ×). With `onQueryChange` the parent searches a server and passes the results as
 * `options`; otherwise `options` are filtered here. 16px text on touch screens (no iOS zoom).
 */
export function Combobox(props: Props) {
  const {
    options,
    placeholder,
    emptyLabel,
    removeLabel,
    onQueryChange,
    loading,
    labelOf,
    invalid,
    disabled,
    className,
  } = props;
  const autoId = useId();
  const id = props.id ?? autoId;
  const listId = `${id}-list`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const selected = props.multiple ? props.value : props.value ? [props.value] : [];
  const known = useRef(new Map<string, string>());
  for (const o of options) known.current.set(o.value, o.label);
  const label = (v: string) => known.current.get(v) ?? labelOf?.(v) ?? v;

  // Server search: wait until typing pauses.
  useEffect(() => {
    if (!onQueryChange) return;
    const t = window.setTimeout(() => onQueryChange(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query, onQueryChange]);

  const shown = useMemo(() => {
    const list = props.multiple ? options.filter((o) => !props.value.includes(o.value)) : options;
    if (onQueryChange || !query.trim()) return list.slice(0, 50);
    const q = norm(query.trim());
    return list.filter((o) => norm(o.label).includes(q) || norm(o.value) === q).slice(0, 50);
  }, [options, query, onQueryChange, props.multiple, props.value]);

  useEffect(() => setActive(0), [query, open]);
  // Close when focus or a tap goes elsewhere.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const pick = (o: ComboOption) => {
    known.current.set(o.value, o.label);
    if (props.multiple) {
      props.onChange([...props.value, o.value]);
      setQuery('');
      input.current?.focus();
    } else {
      props.onChange(o.value);
      setQuery('');
      setOpen(false);
    }
  };
  const remove = (v: string) => {
    if (props.multiple) props.onChange(props.value.filter((x) => x !== v));
    else props.onChange(null);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && shown[active]) {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && !query && props.multiple && props.value.length) {
      remove(props.value[props.value.length - 1]!);
    }
  };

  const single = !props.multiple && props.value ? label(props.value) : '';
  return (
    <div ref={box} className={cn('relative', className)}>
      <div
        className={cn(
          'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-sm border bg-surface-raised px-2 py-1.5 transition-colors',
          'focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15',
          invalid ? 'border-primary-text' : 'border-line',
          disabled && 'cursor-not-allowed bg-surface',
        )}
        onClick={() => input.current?.focus()}
      >
        {props.multiple &&
          props.value.map((v) => (
            <span
              key={v}
              className="inline-flex max-w-full items-center gap-1 rounded-pill bg-primary-soft py-1 pl-3 pr-1 text-small font-bold text-primary-text"
            >
              <span className="truncate">{label(v)}</span>
              <button
                type="button"
                aria-label={`${removeLabel}: ${label(v)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(v);
                }}
                className="inline-flex size-6 items-center justify-center rounded-pill hover:bg-primary/15"
              >
                <Icon name="close" size="xs" />
              </button>
            </span>
          ))}
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${id}-opt-${active}` : undefined}
          aria-describedby={props['aria-describedby']}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          disabled={disabled}
          value={open || !single ? query : single}
          placeholder={selected.length && props.multiple ? '' : single || placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          className="min-w-24 flex-1 bg-transparent px-1 py-1 text-small text-ink outline-none placeholder:text-ink-muted pointer-coarse:text-body"
        />
        {loading ? (
          <Icon name="spinner" spin tone="muted" className="mr-1" />
        ) : !props.multiple && props.value ? (
          <button
            type="button"
            aria-label={`${removeLabel}: ${single}`}
            onClick={(e) => {
              e.stopPropagation();
              remove(props.value!);
            }}
            className="inline-flex size-8 items-center justify-center rounded-pill text-ink-muted hover:bg-surface"
          >
            <Icon name="close" size="xs" />
          </button>
        ) : (
          <Icon name="search" tone="muted" className="mr-1" />
        )}
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable={props.multiple || undefined}
          className="bf-rise absolute inset-x-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-sm border border-line bg-surface-raised py-1 shadow-pop"
        >
          {shown.length ? (
            shown.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={selected.includes(o.value)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex min-h-11 cursor-pointer flex-col justify-center px-3 py-1.5 text-small text-ink',
                  i === active && 'bg-primary-soft/60',
                )}
              >
                <span className="font-medium">{o.label}</span>
                {o.hint && <span className="text-ink-muted">{o.hint}</span>}
              </li>
            ))
          ) : (
            <li className="px-3 py-3 text-small text-ink-muted">{loading ? '…' : emptyLabel}</li>
          )}
        </ul>
      )}
    </div>
  );
}
