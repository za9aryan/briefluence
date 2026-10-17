'use client';
import { convertMinor, formatMoney, TIMEZONE, toMajor, type Currency } from '@briefluence/shared';
import { useFormatter, useLocale, useNow } from 'next-intl';
import { INTL_LOCALE, type Locale } from '@/i18n/config';
import { useDisplayCurrency, useRates } from './currency';

/** Locale-aware formatting; dates always shown in Asia/Yerevan (stored in UTC). */
export function useFormat() {
  const locale = useLocale() as Locale;
  const f = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const intl = INTL_LOCALE[locale];
  const target = useDisplayCurrency();
  const rates = useRates().data?.rates;
  const money = (minor: number, currency: Currency) => formatMoney(minor, currency, intl);
  /** Amount in the viewer's currency; `original` is set when it was converted (shown as secondary). */
  const display = (minor: number, currency: Currency): { main: string; original: string | null } => {
    if (currency === target || !rates) return { main: money(minor, currency), original: null };
    return { main: `≈ ${money(convertMinor(minor, currency, target, rates), target)}`, original: money(minor, currency) };
  };
  return {
    displayCurrency: target,
    display,
    /** Range in the viewer's currency, converted when needed. */
    displayRange: (min: number | null, max: number | null, currency: Currency): { main: string; original: string | null } | null => {
      if (min == null && max == null) return null;
      const conv = (v: number) => (currency === target || !rates ? v : convertMinor(v, currency, target, rates));
      const cur = currency === target || !rates ? currency : target;
      const fmt = (v: number) => money(conv(v), cur);
      const main = min != null && max != null && min !== max ? `${fmt(min)} – ${fmt(max)}` : fmt((min ?? max)!);
      if (cur === currency) return { main, original: null };
      const orig = min != null && max != null && min !== max ? `${money(min, currency)} – ${money(max, currency)}` : money((min ?? max)!, currency);
      return { main: `≈ ${main}`, original: orig };
    },
    /** Converts a minor amount into the viewer's currency (for inputs and filters). */
    toDisplay: (minor: number, currency: Currency) => (currency === target || !rates ? minor : convertMinor(minor, currency, target, rates)),
    money: (minor: number, currency: Currency) => formatMoney(minor, currency, intl),
    moneyRange: (min: number | null, max: number | null, currency: Currency) => {
      if (min != null && max != null && min !== max) {
        return `${formatMoney(min, currency, intl)} – ${formatMoney(max, currency, intl)}`;
      }
      const one = min ?? max;
      return one == null ? null : formatMoney(one, currency, intl);
    },
    major: (minor: number) => toMajor(minor),
    number: (n: number) => f.number(n),
    compact: (n: number) => new Intl.NumberFormat(intl, { notation: 'compact', maximumFractionDigits: 1 }).format(n),
    percent: (n: number) => `${new Intl.NumberFormat(intl, { maximumFractionDigits: 1 }).format(n)}%`,
    date: (d: string | Date) => f.dateTime(new Date(d), { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIMEZONE }),
    dateTime: (d: string | Date) =>
      f.dateTime(new Date(d), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE }),
    relative: (d: string | Date) => f.relativeTime(new Date(d), now),
  };
}
