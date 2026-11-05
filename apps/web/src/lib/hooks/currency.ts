'use client';
import { CURRENCIES, type Currency, type Rates } from '@briefluence/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { api } from '../api';
import { ME_KEY, useMe, type Me } from './session';

export const CURRENCY_COOKIE = 'bf_currency';

export interface RatesDto {
  base: 'AMD';
  rates: Rates;
  source: string;
  fetchedAt: string;
}

export function useRates() {
  return useQuery({
    queryKey: ['currency', 'rates'],
    queryFn: () => api.get<RatesDto>('/currency/rates'),
    staleTime: 60 * 60_000,
  });
}

function readCookie(): Currency | null {
  if (typeof document === 'undefined') return null;
  const m = /(?:^|;\s*)bf_currency=([A-Z]{3})/.exec(document.cookie);
  const v = m?.[1] as Currency | undefined;
  return v && CURRENCIES.includes(v) ? v : null;
}

/** A guest's currency before they pick one: follows the site language. */
const LOCALE_CURRENCY: Record<Locale, Currency> = { en: 'USD', ru: 'RUB', hy: 'AMD' };

/**
 * Currency amounts are shown in: the account setting when signed in, else a cookie, else the one
 * that goes with the site language.
 */
export function useDisplayCurrency(): Currency {
  const { data: me } = useMe();
  const locale = useLocale() as Locale;
  const [cookie, setCookie] = useState<Currency | null>(null);
  useEffect(() => setCookie(readCookie()), []);
  return me?.currency ?? cookie ?? LOCALE_CURRENCY[locale] ?? 'AMD';
}

export function useSetCurrency() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  return useMutation({
    mutationFn: async (currency: Currency) => {
      document.cookie = `${CURRENCY_COOKIE}=${currency}; path=/; max-age=31536000; samesite=lax`;
      if (me) await api.patch('/auth/settings', { currency });
      return currency;
    },
    onSuccess: (currency) => {
      qc.setQueryData<Me | null>(ME_KEY, (old) => (old ? { ...old, currency } : old));
    },
  });
}
