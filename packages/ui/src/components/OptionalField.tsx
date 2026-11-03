'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icon } from '../primitives/Icon';

/**
 * An optional part of a form, folded until wanted: a row with its title, what it does, and
 * "+ Add". Opening slides the fields in (and focuses the first one); "Remove" clears them via
 * `onClear` and folds the row again. Starts open when it already has a value (`filled`).
 */
export function OptionalField({
  title,
  description,
  filled,
  onClear,
  addLabel,
  removeLabel,
  children,
  className,
}: {
  title: ReactNode;
  description: ReactNode;
  filled: boolean;
  onClear: () => void;
  addLabel: string;
  removeLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(filled);
  const id = useId();
  const body = useRef<HTMLDivElement>(null);
  const justOpened = useRef(false);
  // A value set from elsewhere (an edit loaded later) opens the row.
  useEffect(() => {
    if (filled) setOpen(true);
  }, [filled]);
  useEffect(() => {
    if (!open || !justOpened.current) return;
    justOpened.current = false;
    body.current
      ?.querySelector<HTMLElement>(
        'input, select, textarea, button[role="checkbox"], [role="combobox"]',
      )
      ?.focus({ preventScroll: true });
  }, [open]);

  return (
    <div
      className={cn(
        'rounded-card border transition-colors duration-200',
        open
          ? 'border-line bg-surface-raised'
          : 'border-dashed border-line hover:border-primary/40',
        className,
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div id={`${id}-t`} className="font-bold text-ink">
            {title}
          </div>
          <p className="mt-0.5 text-small text-ink-muted">{description}</p>
        </div>
        {open ? (
          <button
            type="button"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-pill px-3 text-small font-bold text-ink-muted hover:bg-surface hover:text-ink"
          >
            <Icon name="close" size="xs" /> {removeLabel}
          </button>
        ) : (
          <button
            type="button"
            aria-expanded={false}
            aria-controls={id}
            aria-describedby={`${id}-t`}
            onClick={() => {
              justOpened.current = true;
              setOpen(true);
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-pill border border-line px-4 text-small font-bold text-primary-text transition hover:border-primary motion-safe:active:scale-[0.97]"
          >
            <Icon name="plus" size="xs" /> {addLabel}
          </button>
        )}
      </div>
      <div
        id={id}
        inert={!open}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        {/* overflow is released once open, so dropdowns inside (search, dates) are not clipped */}
        <div className={cn('min-h-0', open ? 'overflow-visible' : 'overflow-hidden')}>
          <div ref={body} className="px-4 pb-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
