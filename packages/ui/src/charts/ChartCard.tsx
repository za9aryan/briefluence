'use client';
import { useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Heading, Text } from '../primitives/Typography';

export interface ChartRow {
  key: string;
  label: string;
  value: number;
  /** Longer label for tooltips / screen readers (e.g. full date when the axis shows the day). */
  detail?: string;
}

/**
 * Chart container: title, optional subtitle, and a chart/table toggle — every chart has a
 * table twin so no value is reachable only by hovering or by color.
 */
export function ChartCard({
  title,
  subtitle,
  rows,
  valueLabel,
  format = String,
  labels,
  className,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  rows: ChartRow[];
  valueLabel: string;
  format?: (n: number) => string;
  labels: { table: string; chart: string; empty: string; category: string };
  className?: string;
  children: ReactNode;
}) {
  const [table, setTable] = useState(false);
  const empty = rows.every((r) => r.value === 0);
  return (
    <figure className={cn('flex min-w-0 flex-col gap-4 rounded-card border border-line bg-surface-raised p-4 md:p-6', className)}>
      <figcaption className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Heading level={3}>{title}</Heading>
          {subtitle && (
            <Text size="small" tone="muted" className="mt-1">
              {subtitle}
            </Text>
          )}
        </div>
        {!empty && (
          <button
            type="button"
            onClick={() => setTable((x) => !x)}
            aria-pressed={table}
            className="min-h-11 shrink-0 rounded-pill px-3 text-small font-bold text-primary-text hover:bg-primary-soft"
          >
            {table ? labels.chart : labels.table}
          </button>
        )}
      </figcaption>
      {empty ? (
        <Text size="small" tone="muted" className="py-8 text-center">
          {labels.empty}
        </Text>
      ) : table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th className="py-2 pr-4 font-medium">{labels.category}</th>
                <th className="py-2 text-right font-medium">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4 text-ink">{r.label}</td>
                  <td className="py-2 text-right tabular-nums text-ink">{format(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </figure>
  );
}

/** Small tooltip bubble positioned above a point inside a relative container. */
export function ChartTooltip({ x, y, value, label }: { x: number; y: number; value: string; label: string }) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-sm border border-line bg-surface-raised px-2 py-1 shadow-pop"
      style={{ left: x, top: y - 8 }}
    >
      <p className="text-small font-bold whitespace-nowrap text-ink tabular-nums">{value}</p>
      <p className="text-label whitespace-nowrap text-ink-muted normal-case">{label}</p>
    </div>
  );
}
