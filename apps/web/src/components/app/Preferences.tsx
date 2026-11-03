'use client';
import { CURRENCIES, CURRENCY_SYMBOL, type Currency } from '@briefluence/shared';
import { Select, cn } from '@briefluence/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale } from '@/i18n/config';
import { api } from '@/lib/api';
import { useDisplayCurrency, useSetCurrency } from '@/lib/hooks/currency';

/** Switch the UI language; emails and notifications follow the account language too. */
export function useChooseLocale() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (l: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    void api.patch('/auth/settings', { locale: l }).catch(() => undefined);
    start(() => router.refresh());
  };
  return { choose, pending };
}

/** Language + currency selects; changes apply immediately (account menu, sheet, Settings). */
export function PreferenceFields({ className }: { className?: string }) {
  const t = useTranslations('nav');
  const tr = useTranslations('enums');
  const locale = useLocale() as Locale;
  const { choose, pending } = useChooseLocale();
  const currency = useDisplayCurrency();
  const setCurrency = useSetCurrency();
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label className="flex flex-col gap-1">
        <span className="text-label text-ink-muted uppercase">{t('language')}</span>
        <Select
          value={locale}
          disabled={pending}
          onChange={(e) => choose(e.target.value as Locale)}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l} lang={l}>
              {LOCALE_NAMES[l]}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label text-ink-muted uppercase">{t('currency')}</span>
        <Select
          value={currency}
          disabled={setCurrency.isPending}
          onChange={(e) => setCurrency.mutate(e.target.value as Currency)}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {CURRENCY_SYMBOL[c]} {c} · {tr(`currency.${c}`)}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
