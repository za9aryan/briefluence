'use client';
import { useState } from 'react';
import { cn } from '../lib/cn';
import type { ChartRow } from './ChartCard';

/** Fixed categorical slots; a key keeps its slot so color follows the entity, never its rank. */
const SLOTS = ['var(--bf-chart-1)', 'var(--bf-chart-2)', 'var(--bf-chart-3)'] as const;

/**
 * Part-to-whole for ≤ 3 categories. Slices are separated by a 2px surface gap; the legend
 * doubles as direct labels (value + share), so color is never the only identity channel.
 * `order` fixes which key gets which slot.
 */
export function DonutChart({
  rows,
  order,
  centerLabel,
  format = String,
}: {
  rows: ChartRow[];
  order: string[];
  centerLabel: string;
  format?: (n: number) => string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = rows.reduce((a, r) => a + r.value, 0);
  const slot = (key: string) => SLOTS[Math.max(0, order.indexOf(key)) % SLOTS.length]!;
  const sorted = [...rows].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  const size = 160;
  const r = 64;
  const stroke = 24;
  const c = 2 * Math.PI * r;
  const gap = rows.filter((x) => x.value > 0).length > 1 ? 2 : 0;
  let offset = 0;
  const shown = active ? rows.find((x) => x.key === active) : null;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={sorted.map((x) => `${x.label}: ${format(x.value)}`).join(', ')}>
          {sorted.map((x) => {
            const len = total ? (x.value / total) * c : 0;
            const seg = (
              <circle
                key={x.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={slot(x.key)}
                strokeWidth={active === x.key ? stroke + 4 : stroke}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-offset}
                className="cursor-pointer transition-[stroke-width]"
                onPointerEnter={() => setActive(x.key)}
                onPointerLeave={() => setActive(null)}
              />
            );
            offset += len;
            return seg;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-h2 font-bold text-ink">{shown ? format(shown.value) : format(total)}</span>
          <span className="max-w-24 truncate text-label text-ink-muted normal-case">{shown ? shown.label : centerLabel}</span>
        </div>
      </div>
      <ul className="flex w-full min-w-0 flex-col gap-2">
        {sorted.map((x) => (
          <li key={x.key}>
            <button
              type="button"
              onPointerEnter={() => setActive(x.key)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(x.key)}
              onBlur={() => setActive(null)}
              className={cn('flex min-h-11 w-full items-center gap-2 rounded-sm px-2 text-left', active === x.key && 'bg-surface')}
            >
              <span className="size-3 shrink-0 rounded-[3px]" style={{ background: slot(x.key) }} />
              <span className="min-w-0 flex-1 truncate text-small text-ink">{x.label}</span>
              <span className="text-small font-bold text-ink tabular-nums">{total ? Math.round((x.value / total) * 100) : 0}%</span>
              <span className="w-12 text-right text-small text-ink-muted tabular-nums">{format(x.value)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
