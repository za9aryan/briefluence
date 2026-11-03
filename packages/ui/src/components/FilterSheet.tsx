'use client';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icon } from '../primitives/Icon';
import { Heading } from '../primitives/Typography';

/**
 * Phone filters: one "Filters" pill (with how many are on) that opens a bottom sheet (<Modal>).
 * Wider screens keep the row of <FilterDropdown>s.
 */
export function FiltersButton({
  label,
  count,
  onClick,
  className,
}: {
  label: string;
  count: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-pill border px-4 text-small font-bold whitespace-nowrap transition-colors',
        count > 0
          ? 'border-primary bg-primary-soft text-primary-text'
          : 'border-line bg-surface-raised text-ink hover:border-primary/40',
        className,
      )}
    >
      <Icon name="filter" size="sm" />
      {label}
      {count > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-primary px-1.5 text-[11px] leading-none tabular-nums text-on-primary">
          {count}
        </span>
      )}
    </button>
  );
}

/** One titled group inside the filter sheet (platform, niche, ...), divided by lines. */
export function SheetSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0">
      <Heading level={3} size="body" className="mb-3">
        {title}
      </Heading>
      {children}
    </section>
  );
}
