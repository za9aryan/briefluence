'use client';
import { useRef, useState } from 'react';
import { ChartTooltip, type ChartRow } from './ChartCard';

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/**
 * Vertical columns (one series): counts per day or per ordered bucket. Columns are ≤ 24px with a
 * 4px rounded top, hairline solid grid, 3 y-ticks; x labels are thinned to avoid collisions.
 * Each column band (full height) is the hover/focus target.
 */
export function ColumnChart({
  rows,
  format = String,
  height = 180,
  xLabelEvery,
}: {
  rows: ChartRow[];
  format?: (n: number) => string;
  height?: number;
  /** Show every Nth x label (default: auto, ~8 labels). */
  xLabelEvery?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const max = niceMax(Math.max(0, ...rows.map((r) => r.value)));
  const ticks = [0, max / 2, max];
  const every = xLabelEvery ?? Math.max(1, Math.ceil(rows.length / 8));
  const pct = (v: number) => (v / max) * 100;
  const a = active != null ? rows[active] : null;

  return (
    // Top padding keeps the highest y-tick label clear of the card header.
    <div className="flex gap-2 pt-4">
      {/* y axis */}
      <div className="relative w-8 shrink-0 text-right" style={{ height }} aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2 text-[11px] text-ink-muted tabular-nums" style={{ bottom: `calc(${pct(t)}% - 0.5em)` }}>
            {format(t)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div ref={box} className="relative" style={{ height }}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-line" style={{ bottom: `${pct(t)}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-0.5">
            {rows.map((r, i) => (
              <div
                key={r.key}
                tabIndex={0}
                aria-label={`${r.detail ?? r.label}: ${format(r.value)}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="flex h-full min-w-0 flex-1 cursor-default items-end justify-center outline-none"
              >
                <div
                  className="w-full max-w-6 rounded-t-[4px] bg-chart-1 transition-opacity"
                  style={{ height: `${pct(r.value)}%`, opacity: active == null || active === i ? 1 : 0.45, minHeight: r.value > 0 ? 2 : 0 }}
                />
              </div>
            ))}
          </div>
          {a && active != null && (
            <ChartTooltip
              x={((active + 0.5) / rows.length) * (box.current?.clientWidth ?? 0)}
              y={height - (pct(a.value) / 100) * height}
              value={format(a.value)}
              label={a.detail ?? a.label}
            />
          )}
        </div>
        {/* x axis */}
        <div className="mt-2 flex gap-0.5" aria-hidden>
          {rows.map((r, i) => (
            <span
              key={r.key}
              className={every === 1 ? 'min-w-0 flex-1 text-center text-[11px] leading-tight break-words text-ink-muted' : 'min-w-0 flex-1 overflow-visible text-center text-[11px] whitespace-nowrap text-ink-muted'}
            >
              {i % every === 0 ? r.label : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
