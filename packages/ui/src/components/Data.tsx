import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icon, type IconName } from '../primitives/Icon';
import { Text } from '../primitives/Typography';

/** 0–100 match score as a compact ring. */
export function ScoreMeter({ value, label, size = 'md' }: { value: number; label: string; size?: 'sm' | 'md' | 'lg' }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const tone = v >= 75 ? 'stroke-success' : v >= 50 ? 'stroke-primary' : 'stroke-ink-muted';
  const dim = { sm: 'size-11 text-[11px]', md: 'size-12 text-small', lg: 'size-16 text-small' }[size];
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn('relative inline-flex shrink-0 items-center justify-center', dim)} role="img" aria-label={`${label}: ${v}%`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={r} className="fill-none stroke-line" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} className={cn('fill-none transition-all', tone)} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />
      </svg>
      <span className="font-bold tabular-nums text-ink">{v}</span>
    </div>
  );
}

export function Progress({ value, label, className }: { value: number; label: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} className={cn('h-2 w-full overflow-hidden rounded-pill bg-line', className)}>
      <div className="h-full rounded-pill bg-primary transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}

/** KPI tile for dashboards. */
export function Stat({ label, value, icon, hint, className }: { label: ReactNode; value: ReactNode; icon?: IconName; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2 rounded-card border border-line bg-surface-raised p-4 shadow-card md:p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Text size="small" tone="muted" weight="medium" truncate>
          {label}
        </Text>
        {icon && (
          <span className="inline-flex size-8 items-center justify-center rounded-sm bg-primary-soft">
            <Icon name={icon} tone="accent" />
          </span>
        )}
      </div>
      <p className="text-h2 font-bold text-ink break-words md:text-h1">{value}</p>
      {hint && <Text size="small">{hint}</Text>}
    </div>
  );
}

/** Key/value list, stacked on phones and two-column from `sm`. */
export function DescriptionList({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('divide-y divide-line', className)}>
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-1 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt className="text-small text-ink-muted">{it.label}</dt>
          <dd className="text-small text-ink sm:col-span-2">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Wizard steps; labels collapse to numbers on small screens. */
export function Stepper({ steps, current, onSelect }: { steps: string[]; current: number; onSelect?: (i: number) => void }) {
  return (
    <ol className="flex w-full items-center gap-2">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!onSelect || i > current}
              onClick={() => onSelect?.(i)}
              aria-current={active ? 'step' : undefined}
              className="flex min-w-0 items-center gap-2 disabled:cursor-default"
            >
              <span
                className={cn(
                  'inline-flex size-7 shrink-0 items-center justify-center rounded-pill text-small font-bold',
                  done && 'bg-primary text-on-primary',
                  active && 'bg-primary-soft text-primary-text ring-2 ring-primary',
                  !done && !active && 'bg-surface text-ink-muted',
                )}
              >
                {done ? <Icon name="check" size="xs" /> : i + 1}
              </span>
              <span className={cn('hidden truncate text-small md:inline', active ? 'font-bold text-ink' : 'text-ink-muted')}>{s}</span>
            </button>
            {i < steps.length - 1 && <span className={cn('h-px flex-1', done ? 'bg-primary' : 'bg-line')} />}
          </li>
        );
      })}
    </ol>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  labels,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (p: number) => void;
  labels: { prev: string; next: string; summary: string };
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-4 pt-2">
      <Text size="small" tone="muted">
        {labels.summary}
      </Text>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="inline-flex h-11 items-center gap-1 rounded-sm border border-line bg-surface-raised px-3 text-small disabled:opacity-40">
          <Icon name="chevron-left" /> <span className="hidden sm:inline">{labels.prev}</span>
        </button>
        <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} className="inline-flex h-11 items-center gap-1 rounded-sm border border-line bg-surface-raised px-3 text-small disabled:opacity-40">
          <span className="hidden sm:inline">{labels.next}</span> <Icon name="chevron-right" />
        </button>
      </div>
    </nav>
  );
}
