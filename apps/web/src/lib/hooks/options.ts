'use client';
import {
  ALL_COUNTRIES,
  CITIES,
  COLLABORATION_TYPES,
  CONTENT_FORMATS,
  COUNTRIES,
  GENDERS,
  LANGUAGES,
  NICHES,
  PAYMENT_TYPES,
  PLATFORMS,
  type Country,
  type Platform,
} from '@briefluence/shared';
import type { IconName } from '@briefluence/ui';
import { useLocale, useTranslations } from 'next-intl';

export const PLATFORM_ICON: Record<Platform, IconName> = {
  INSTAGRAM: 'instagram',
  TIKTOK: 'tiktok',
  YOUTUBE: 'youtube',
};

/** Translated option lists for selects and chip groups. */
/** Country names in the UI language from the browser (cached per language). */
const regionNames = new Map<string, Intl.DisplayNames | null>();
function regionName(locale: string, code: string): string | undefined {
  if (!regionNames.has(locale)) {
    try {
      regionNames.set(
        locale,
        new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }),
      );
    } catch {
      regionNames.set(locale, null);
    }
  }
  return regionNames.get(locale)?.of(code) ?? undefined;
}

export function useOptions() {
  const t = useTranslations('enums');
  const locale = useLocale();
  const countryName = (c: string) =>
    t.has(`country.${c}`) ? t(`country.${c}`) : (regionName(locale, c) ?? c);
  const popular = new Set<string>(COUNTRIES);
  return {
    platforms: PLATFORMS.map((p): { value: Platform; label: string; icon: IconName } => ({
      value: p,
      label: t(`platform.${p}`),
      icon: PLATFORM_ICON[p],
    })),
    niches: NICHES.map((n) => ({ value: n, label: t(`niche.${n}`) })),
    languages: LANGUAGES.map((l) => ({ value: l, label: t(`language.${l}`) })),
    countries: COUNTRIES.map((c) => ({ value: c, label: t(`country.${c}`) })),
    /** Every country: the launch markets first, then the rest A–Z in the UI language. */
    allCountries: [
      ...COUNTRIES.map((c) => ({ value: c as string, label: countryName(c) })),
      ...ALL_COUNTRIES.filter((c) => !popular.has(c))
        .map((c) => ({ value: c, label: countryName(c) }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    ],
    citiesOf: (countries: string[]) =>
      countries.flatMap((c) =>
        (CITIES[c as Country] ?? []).map((city) => ({ value: city, label: city })),
      ),
    formats: CONTENT_FORMATS.map((f) => ({ value: f, label: t(`contentFormat.${f}`) })),
    paymentTypes: PAYMENT_TYPES.map((p) => ({ value: p, label: t(`paymentType.${p}`) })),
    collaboration: COLLABORATION_TYPES.map((c) => ({
      value: c,
      label: t(`collaboration.${c}`),
      icon: (c === 'LONG_TERM' ? 'repeat' : 'clock') as IconName,
    })),
    genders: GENDERS.map((g) => ({ value: g, label: t(`gender.${g}`) })),
    country: countryName,
    niche: (n: string) => (t.has(`niche.${n}`) ? t(`niche.${n}`) : n),
    language: (l: string) => (t.has(`language.${l}`) ? t(`language.${l}`) : l),
  };
}
