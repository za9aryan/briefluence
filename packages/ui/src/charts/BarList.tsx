'use client';
import { useState } from 'react';
import { cn } from '../lib/cn';
import type { ChartRow } from './ChartCard';

/**
 * Horizontal bars for comparing magnitude across many / long-named categories (one series,
 * one color). Value sits at the bar tip; the whole row is the hover/focus target.
 */
export function BarList({ rows, format = String, max: maxRows = 10 }: { rows: ChartRow[]; format?: (n: number) => string; max?: number }) {
  const [active, setActive] = useState<string | null>(null);
  const list = [...rows].sort((a, b) => b.value - a.value).slice(0, maxRows);
  const max = Math.max(1, ...list.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2">
      {list.map((r) => (
        <li
          key={r.key}
          tabIndex={0}
          onPointerEnter={() => setActive(r.key)}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(r.key)}
          onBlur={() => setActive(null)}
          className={cn('grid grid-cols-[minmax(5rem,9rem)_1fr] items-center gap-4 rounded-sm px-1 py-1 outline-none', active === r.key && 'bg-surface')}
        >
          <span className="truncate text-small text-ink">{r.label}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn('h-3 rounded-r-[4px] bg-chart-1 transition-opacity', active && active !== r.key && 'opacity-50')}
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
            <span className="shrink-0 text-small font-bold text-ink tabular-nums">{format(r.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
