'use client';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

/** Underlined tabs that scroll horizontally on narrow screens. Controlled. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1', className)}>
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-small font-medium transition-colors',
              active ? 'border-primary text-primary-text' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.count != null && (
              <span className={cn('rounded-pill px-1.5 text-small', active ? 'bg-primary-soft text-primary-text' : 'bg-surface text-ink-muted')}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
