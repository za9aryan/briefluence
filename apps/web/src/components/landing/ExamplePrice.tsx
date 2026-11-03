'use client';
import { convertMinor, formatMoney, toMinor, type Currency } from '@briefluence/shared';
import { useLocale } from 'next-intl';
import { INTL_LOCALE, type Locale } from '@/i18n/config';
import { useDisplayCurrency, useRates } from '@/lib/hooks/currency';

/** Round steps per currency so examples read like real prices (AMD 20,000, not AMD 19,437). */
const STEP: Record<Currency, number> = { AMD: 1000, RUB: 100, USD: 5 };

/**
 * A price in a marketing example, shown in the visitor's currency (their setting or the currency
 * switcher), converted and rounded. `amount` is in major units of `currency`; give `to` for a
 * range. Without rates yet it shows the original currency.
 */
export function ExamplePrice({
  amount,
  to,
  currency,
}: {
  amount: number;
  to?: number;
  currency: Currency;
}) {
  const locale = useLocale() as Locale;
  const target = useDisplayCurrency();
  const rates = useRates().data?.rates;
  const out = rates && target !== currency ? target : currency;
  const one = (major: number) => {
    const minor =
      out === currency ? toMinor(major) : convertMinor(toMinor(major), currency, out, rates!);
    const step = STEP[out] * 100;
    const rounded = Math.max(step, Math.round(minor / step) * step);
    return formatMoney(rounded, out, INTL_LOCALE[locale]).replace(/[.,]00(?=\D*$)/, '');
  };
  return <>{to != null ? `${one(amount)} – ${one(to)}` : one(amount)}</>;
}
