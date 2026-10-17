'use client';
import { Icon, Menu, MenuItem, cn } from '@briefluence/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale } from '@/i18n/config';

export function LanguageSwitcher({ compact, className }: { compact?: boolean; className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();

  const choose = (l: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  };

  return (
    <Menu
      align="end"
      trigger={(p) => (
        <button
          type="button"
          onClick={p.toggle}
          aria-expanded={p['aria-expanded']}
          aria-haspopup={p['aria-haspopup']}
          aria-label={t('language')}
          className={cn(
            'inline-flex h-11 items-center gap-1.5 rounded-pill px-3 text-small font-bold text-ink-muted hover:bg-primary-soft/60 hover:text-ink',
            className,
          )}
        >
          <Icon name={pending ? 'spinner' : 'globe'} spin={pending} />
          <span className={cn(compact && 'sr-only sm:not-sr-only')}>{locale.toUpperCase()}</span>
        </button>
      )}
    >
      {(close) =>
        LOCALES.map((l) => (
          <MenuItem
            key={l}
            lang={l}
            onClick={() => {
              close();
              if (l !== locale) choose(l);
            }}
            className={cn(l === locale && 'font-bold text-primary-text')}
          >
            <span className="w-6 text-label text-ink-muted">{l.toUpperCase()}</span>
            {LOCALE_NAMES[l]}
            {l === locale && <Icon name="check" className="ml-auto" />}
          </MenuItem>
        ))
      }
    </Menu>
  );
}
