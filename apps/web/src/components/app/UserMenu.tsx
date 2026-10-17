'use client';
import { CURRENCIES, CURRENCY_SYMBOL, type Currency } from '@briefluence/shared';
import { Avatar, Icon, Menu, MenuItem, Select, Text } from '@briefluence/ui';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale } from '@/i18n/config';
import { api } from '@/lib/api';
import { useDisplayCurrency, useSetCurrency } from '@/lib/hooks/currency';
import { landingPath, useLogout, type Me } from '@/lib/hooks/session';

export function displayName(me: Me) {
  return me.influencer?.displayName ?? me.brand?.companyName ?? me.email;
}

/** Account dropdown for signed-in users: profile, language, currency, sign out. */
export function UserMenu({ me, showDashboard }: { me: Me; showDashboard?: boolean }) {
  const t = useTranslations('nav');
  const tr = useTranslations('enums');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, start] = useTransition();
  const logout = useLogout();
  const currency = useDisplayCurrency();
  const setCurrency = useSetCurrency();

  const chooseLocale = (l: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    // Emails and notifications follow the account language.
    void api.patch('/auth/settings', { locale: l }).catch(() => undefined);
    start(() => router.refresh());
  };
  const item = 'flex min-h-11 w-full items-center gap-2 px-4 text-small text-ink hover:bg-surface';

  return (
    <Menu
      className="w-72"
      trigger={(p) => (
        <button
          type="button"
          onClick={p.toggle}
          aria-expanded={p['aria-expanded']}
          aria-haspopup={p['aria-haspopup']}
          aria-label={t('account')}
          className="inline-flex min-h-11 items-center gap-2 rounded-pill pl-1 pr-2 hover:bg-primary-soft/60"
        >
          <Avatar size="sm" name={displayName(me)} src={me.influencer?.avatarUrl ?? me.brand?.logoUrl} />
          <span className="hidden text-label text-ink-muted sm:inline">
            {locale.toUpperCase()} · {currency}
          </span>
          <Icon name={pending ? 'spinner' : 'chevron-down'} spin={pending} tone="muted" className="hidden sm:block" />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="border-b border-line px-4 py-2">
            <Text size="small" weight="bold" truncate>
              {displayName(me)}
            </Text>
            <Text size="small" tone="muted" truncate>
              {/* Admins have no profile name, so the email is already the title. */}
              {me.role === 'ADMIN' ? tr('role.ADMIN') : `${me.email} · ${tr(`role.${me.role}`)}`}
            </Text>
          </div>
          {showDashboard && (
            <Link href={landingPath(me)} onClick={close} className={item}>
              <Icon name="dashboard" /> {t('dashboard')}
            </Link>
          )}
          {me.role !== 'ADMIN' && (
            <Link href={me.role === 'BRAND' ? '/brand/account' : '/influencer/account'} onClick={close} className={item}>
              <Icon name="settings" /> {t('settings')}
            </Link>
          )}

          {/* Preferences: two selects instead of long lists; changes apply immediately. */}
          <div className="flex flex-col gap-2 border-t border-line px-4 py-2">
            <label className="flex flex-col gap-1">
              <span className="text-label text-ink-muted uppercase">{t('language')}</span>
              <Select value={locale} disabled={pending} onChange={(e) => chooseLocale(e.target.value as Locale)}>
                {LOCALES.map((l) => (
                  <option key={l} value={l} lang={l}>
                    {LOCALE_NAMES[l]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label text-ink-muted uppercase">{t('currency')}</span>
              <Select value={currency} disabled={setCurrency.isPending} onChange={(e) => setCurrency.mutate(e.target.value as Currency)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_SYMBOL[c]} {c} · {tr(`currency.${c}`)}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="border-t border-line">
            <MenuItem
              className="min-h-11 px-4 text-small"
              onClick={() => {
                close();
                logout.mutate();
              }}
            >
              <Icon name="logout" /> {t('logout')}
            </MenuItem>
          </div>
        </>
      )}
    </Menu>
  );
}
