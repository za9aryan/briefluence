import { describe, expect, it } from 'vitest';
import { byIndex, dailySeries, lastDays, periodTotals, points, share } from './traffic.report';

const row = (keys: string[], values: (string | number)[]) => ({
  dimensionValues: keys.map((value) => ({ value })),
  metricValues: values.map((v) => ({ value: String(v) })),
});

describe('traffic report helpers', () => {
  it('reads points biggest first, without "(not set)"', () => {
    const r = { rows: [row(['Armenia'], [3]), row(['(not set)'], [9]), row(['Russia'], [7])] };
    expect(points(r)).toEqual([
      { key: 'Russia', count: 7 },
      { key: 'Armenia', count: 3 },
    ]);
    expect(points(null)).toEqual([]);
  });

  it('splits two date ranges into current and previous', () => {
    const r = { rows: [row(['date_range_1'], [4, 10]), row(['date_range_0'], [6, 12])] };
    expect(periodTotals(r, 2)).toEqual({ current: [6, 12], previous: [4, 10] });
    expect(periodTotals({ rows: [] }, 2)).toEqual({ current: [0, 0], previous: [0, 0] });
  });

  it('fills every day of the period', () => {
    const days = lastDays('2026-11-17', 3);
    expect(days).toEqual(['2026-11-15', '2026-11-16', '2026-11-17']);
    const r = { rows: [row(['20261116'], [5, 8])] };
    expect(dailySeries(r, days, 2)).toEqual([
      { day: '2026-11-15', values: [0, 0] },
      { day: '2026-11-16', values: [5, 8] },
      { day: '2026-11-17', values: [0, 0] },
    ]);
  });

  it('places numeric dimensions by index and ignores the rest', () => {
    const r = { rows: [row(['0'], [2]), row(['23'], [5]), row(['24'], [9]), row(['x'], [1])] };
    const hours = byIndex(r, 24);
    expect(hours[0]).toBe(2);
    expect(hours[23]).toBe(5);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(7);
  });

  it('shares in percent', () => {
    expect(share(1, 3)).toBe(33.3);
    expect(share(5, 0)).toBe(0);
  });
});
