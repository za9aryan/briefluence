'use client';
import {
  CITIES,
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
import { useTranslations } from 'next-intl';

export const PLATFORM_ICON: Record<Platform, IconName> = { INSTAGRAM: 'instagram', TIKTOK: 'tiktok', YOUTUBE: 'youtube' };

/** Translated option lists for selects and chip groups. */
export function useOptions() {
  const t = useTranslations('enums');
  return {
    platforms: PLATFORMS.map((p): { value: Platform; label: string; icon: IconName } => ({ value: p, label: t(`platform.${p}`), icon: PLATFORM_ICON[p] })),
    niches: NICHES.map((n) => ({ value: n, label: t(`niche.${n}`) })),
    languages: LANGUAGES.map((l) => ({ value: l, label: t(`language.${l}`) })),
    countries: COUNTRIES.map((c) => ({ value: c, label: t(`country.${c}`) })),
    citiesOf: (countries: string[]) =>
      countries.flatMap((c) => (CITIES[c as Country] ?? []).map((city) => ({ value: city, label: city }))),
    formats: CONTENT_FORMATS.map((f) => ({ value: f, label: t(`contentFormat.${f}`) })),
    paymentTypes: PAYMENT_TYPES.map((p) => ({ value: p, label: t(`paymentType.${p}`) })),
    genders: GENDERS.map((g) => ({ value: g, label: t(`gender.${g}`) })),
    country: (c: string) => (t.has(`country.${c}`) ? t(`country.${c}`) : c),
    niche: (n: string) => (t.has(`niche.${n}`) ? t(`niche.${n}`) : n),
    language: (l: string) => (t.has(`language.${l}`) ? t(`language.${l}`) : l),
  };
}
