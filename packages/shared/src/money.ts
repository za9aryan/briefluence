import type { Currency } from './enums';

/** All money is stored as integers in minor units (1 USD = 100 cents, 1 AMD = 100 luma, 1 RUB = 100 kopeks). */
export const MINOR_PER_MAJOR = 100;

export const toMinor = (major: number): number => Math.round(major * MINOR_PER_MAJOR);
export const toMajor = (minor: number): number => minor / MINOR_PER_MAJOR;

/** Whole units for AMD and RUB (amounts are large, cents are noise); cents for USD. */
const FRACTION: Record<Currency, number> = { AMD: 0, RUB: 0, USD: 2 };

export const CURRENCY_SYMBOL: Record<Currency, string> = { AMD: '֏', USD: '$', RUB: '₽' };

export function formatMoney(minor: number, currency: Currency, locale = 'en-US'): string {
  const digits = FRACTION[currency];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(toMajor(minor));
}

/**
 * Exchange rates as "AMD per 1 unit" (the Central Bank of Armenia's format), e.g.
 * { AMD: 1, USD: 362.34, RUB: 4.33 }.
 */
export type Rates = Record<Currency, number>;

/** Converts a minor-unit amount between currencies, rounding to whole minor units. */
export function convertMinor(minor: number, from: Currency, to: Currency, rates: Rates): number {
  if (from === to) return minor;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!(fromRate > 0) || !(toRate > 0)) throw new Error(`Missing exchange rate for ${from} or ${to}`);
  return Math.round((minor * fromRate) / toRate);
}
