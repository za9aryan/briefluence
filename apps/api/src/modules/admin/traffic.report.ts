/**
 * Pure helpers that turn Google Analytics Data API responses
 * (https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/RunReportResponse)
 * into the shapes the admin Statistics page draws. Values arrive as strings.
 */
export interface GaRow {
  dimensionValues?: { value?: string | null }[] | null;
  metricValues?: { value?: string | null }[] | null;
}
export interface GaReport {
  rows?: GaRow[] | null;
}

export interface Point {
  key: string;
  count: number;
}

const num = (v?: string | null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Each row as its dimension values and numeric metric values. */
export function readRows(report: GaReport | null | undefined) {
  return (report?.rows ?? []).map((r) => ({
    keys: (r.dimensionValues ?? []).map((d) => d.value ?? ''),
    values: (r.metricValues ?? []).map((m) => num(m.value)),
  }));
}

/** One dimension + one metric as points, biggest first; "(not set)" and empty keys dropped. */
export function points(report: GaReport | null | undefined, metric = 0): Point[] {
  return readRows(report)
    .map((r) => ({ key: r.keys[0] ?? '', count: r.values[metric] ?? 0 }))
    .filter((p) => p.key && p.key !== '(not set)')
    .sort((a, b) => b.count - a.count);
}

/**
 * Metrics for the current and previous period from a report with two date ranges and no
 * dimensions. With several date ranges the response has a `dateRange` dimension valued
 * `date_range_0`, `date_range_1`, … when the ranges have no names
 * (https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/DateRange);
 * missing rows mean zero.
 */
export function periodTotals(report: GaReport | null | undefined, metrics: number) {
  const zero = () => Array.from({ length: metrics }, () => 0);
  const out = { current: zero(), previous: zero() };
  for (const r of readRows(report)) {
    if (r.keys.includes('date_range_0')) out.current = r.values;
    else if (r.keys.includes('date_range_1')) out.previous = r.values;
  }
  return out;
}

/** GA `date` values (YYYYMMDD) → ISO day (YYYY-MM-DD). */
export const gaDay = (v: string) => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;

/** Per-day metric values for every day in `days` (ISO dates); days without data are 0. */
export function dailySeries(report: GaReport | null | undefined, days: string[], metrics: number) {
  const byDay = new Map(readRows(report).map((r) => [gaDay(r.keys[0] ?? ''), r.values]));
  return days.map((day) => ({
    day,
    values: byDay.get(day) ?? Array.from({ length: metrics }, () => 0),
  }));
}

/** Values for 0…size-1 of a numeric dimension (hour 0–23, dayOfWeek 0–6, minutesAgo 0–29). */
export function byIndex(report: GaReport | null | undefined, size: number, metric = 0) {
  const out = Array.from({ length: size }, () => 0);
  for (const r of readRows(report)) {
    const i = r.keys[0] ? Number(r.keys[0]) : NaN;
    if (Number.isInteger(i) && i >= 0 && i < size) out[i] = (out[i] ?? 0) + (r.values[metric] ?? 0);
  }
  return out;
}

/** The last `count` calendar days up to and including `today` (ISO dates, oldest first). */
export function lastDays(today: string, count: number) {
  const end = new Date(`${today}T00:00:00Z`).getTime();
  return Array.from({ length: count }, (_, i) =>
    new Date(end - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10),
  );
}

/** Share in percent (0–100, one decimal); 0 when there is nothing to divide by. */
export const share = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
