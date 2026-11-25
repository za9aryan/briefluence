'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '../lib/cn';
import { createPortal } from 'react-dom';
import { FLOATING_ATTR, useFloatingList } from '../lib/floating';
import { Icon, type IconName } from '../primitives/Icon';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** Second line, e.g. what the choice means. */
  hint?: string;
  icon?: IconName;
  /** Language of the label (language names in their own language). */
  lang?: string;
}

export interface SelectProps<T extends string = string> {
  id?: string;
  options: SelectOption<T>[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  /** Shown while no option is chosen. */
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  /**
   * `pill` for filter bars (`active` highlights it while a filter is set); `inline` sits inside
   * another field (the currency of an amount).
   */
  variant?: 'field' | 'pill' | 'inline';
  active?: boolean;
  onBlur?: () => void;
  name?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  className?: string;
}

/**
 * Pick one of a short list. Same field and list look as the searchable Combobox (countries,
 * cities); use that one for long lists. Keyboard as a select-only combobox
 * (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/):
 * arrows, Home/End, Enter/Space, Esc, and typing a letter jumps to the next match.
 */
export function Select<T extends string = string>({
  options,
  value,
  onChange,
  placeholder,
  invalid,
  disabled,
  variant = 'field',
  active: highlighted,
  onBlur,
  name,
  className,
  ...aria
}: SelectProps<T>) {
  const autoId = useId();
  const id = aria.id ?? autoId;
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const { style, host } = useFloatingList(open, button, list);
  const typed = useRef({ text: '', at: 0 });
  const index = options.findIndex((o) => o.value === value);
  const current = index >= 0 ? options[index] : undefined;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);
  // Keep the highlighted option in view.
  useEffect(() => {
    if (open)
      list.current
        ?.querySelector(`#${CSS.escape(`${id}-opt-${active}`)}`)
        ?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);

  const show = () => {
    setActive(Math.max(0, index));
    setOpen(true);
  };
  const pick = (i: number) => {
    const o = options[i];
    if (o && o.value !== value) onChange(o.value);
    setOpen(false);
    button.current?.focus();
  };
  const jump = (key: string) => {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at > 700 ? key : t.text + key;
    t.at = now;
    const q = t.text.toLocaleLowerCase();
    // One letter: the next match after the current option; a word: from the current one.
    const n = options.length;
    const start = (open ? active : Math.max(0, index)) + (t.text.length > 1 ? 0 : 1);
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      const o = options[i]!;
      if (!o.label.toLocaleLowerCase().startsWith(q)) continue;
      if (open) setActive(i);
      else if (o.value !== value) onChange(o.value);
      return;
    }
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const last = options.length - 1;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        if (!open) show();
        else setActive((i) => Math.min(last, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1))));
        break;
      case 'Home':
      case 'End':
        if (!open) return;
        e.preventDefault();
        setActive(e.key === 'Home' ? 0 : last);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open) pick(active);
        else show();
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          e.stopPropagation(); // don't also close the dialog around it
          setOpen(false);
        }
        break;
      case 'Tab':
        if (open) pick(active);
        break;
      default:
        if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) jump(e.key);
    }
  };

  const pill = variant === 'pill';
  return (
    <div ref={box} className={cn('relative', className)}>
      <div
        ref={button}
        id={id}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        aria-label={aria['aria-label']}
        aria-describedby={aria['aria-describedby']}
        aria-invalid={invalid || undefined}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        onBlur={onBlur}
        className={cn(
          'flex min-h-11 w-full cursor-pointer select-none items-center gap-2 border text-small transition-colors outline-none pointer-coarse:text-body',
          'focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15',
          pill
            ? 'rounded-pill px-4 font-bold whitespace-nowrap'
            : variant === 'inline'
              ? 'h-full min-h-0 rounded-r-sm px-3 font-bold whitespace-nowrap'
              : 'rounded-sm px-3',
          highlighted
            ? 'border-primary bg-primary-soft text-primary-text'
            : variant === 'inline'
              ? 'border-0 bg-surface text-ink'
              : invalid
                ? 'border-primary-text bg-surface-raised text-ink'
                : open
                  ? 'border-primary bg-surface-raised text-ink ring-3 ring-primary/15'
                  : 'border-line bg-surface-raised text-ink hover:border-primary/40',
          disabled && 'cursor-not-allowed bg-surface text-ink-muted hover:border-line',
        )}
      >
        {current?.icon && <Icon name={current.icon} tone="muted" />}
        <span
          lang={current?.lang}
          className={cn('min-w-0 flex-1 truncate', !current && 'text-ink-muted')}
        >
          {current?.label ?? placeholder ?? ''}
        </span>
        <Icon
          name="chevron-down"
          size={pill ? 'xs' : 'sm'}
          tone={highlighted ? undefined : 'muted'}
          className={cn('shrink-0 transition-transform', open && 'rotate-180')}
        />
      </div>
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      {open &&
        host &&
        createPortal(
          <ul
            {...{ [FLOATING_ATTR]: '' }}
            ref={list}
            id={listId}
            role="listbox"
            aria-label={aria['aria-label']}
            style={style}
            className="bf-rise fixed z-[60] w-max overflow-y-auto rounded-sm border border-line bg-surface-raised py-1 shadow-pop"
          >
            {options.map((o, i) => {
              const on = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={on}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => pick(i)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-2 px-3 py-1.5 text-small text-ink',
                    i === active && 'bg-primary-soft/60',
                  )}
                >
                  {o.icon && <Icon name={o.icon} tone="muted" />}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span lang={o.lang} className={cn(on ? 'font-bold' : 'font-medium')}>
                      {o.label}
                    </span>
                    {o.hint && <span className="text-ink-muted">{o.hint}</span>}
                  </span>
                  <Icon
                    name="check"
                    size="sm"
                    className={cn('shrink-0 text-primary-text', !on && 'invisible')}
                  />
                </li>
              );
            })}
          </ul>,
          host,
        )}
    </div>
  );
}
