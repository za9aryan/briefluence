'use client';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/format';
import { useOptions } from '@/lib/hooks/options';
import type { DealDto } from '@/lib/types';

/** "Who they are looking for" rows of a brief (influencer view and admin view). */
export function useDealRequirements() {
  const t = useTranslations('deals');
  const tc = useTranslations('common');
  const te = useTranslations('enums');
  const f = useFormat();
  const o = useOptions();
  const range = (min: number | null, max: number | null, fmt: (n: number) => string = String) =>
    min == null && max == null
      ? tc('any')
      : min != null && max != null
        ? `${fmt(min)}–${fmt(max)}`
        : min != null
          ? `${fmt(min)}+`
          : `≤ ${fmt(max!)}`;
  return (d: DealDto) => [
    { label: t('req.platforms'), value: d.platforms.map((p) => te(`platform.${p}`)).join(', ') },
    {
      label: t('req.formats'),
      value: d.contentFormats.map((x) => te(`contentFormat.${x}`)).join(', '),
    },
    {
      label: t('req.location'),
      value: [d.countries.map(o.country).join(', '), d.cities.join(', ')]
        .filter(Boolean)
        .join(' · '),
    },
    { label: t('req.followers'), value: range(d.minFollowers, d.maxFollowers, f.compact) },
    ...(d.minEngagementRate
      ? [{ label: t('req.engagement'), value: `≥ ${f.percent(d.minEngagementRate)}` }]
      : []),
    ...(d.niches.length
      ? [{ label: t('req.niches'), value: d.niches.map(o.niche).join(', ') }]
      : []),
    ...(d.languages.length
      ? [{ label: t('req.languages'), value: d.languages.map(o.language).join(', ') }]
      : []),
    ...(d.influencerGender !== 'ANY'
      ? [{ label: t('req.bloggerGender'), value: te(`genderFilter.${d.influencerGender}`) }]
      : []),
    ...(d.influencerAgeMin != null || d.influencerAgeMax != null
      ? [{ label: t('req.bloggerAge'), value: range(d.influencerAgeMin, d.influencerAgeMax) }]
      : []),
    ...(d.audienceGender !== 'ANY'
      ? [{ label: t('req.audienceGender'), value: te(`audienceGender.${d.audienceGender}`) }]
      : []),
    ...(d.audienceAgeMin != null || d.audienceAgeMax != null
      ? [{ label: t('req.audienceAge'), value: range(d.audienceAgeMin, d.audienceAgeMax) }]
      : []),
    ...(d.audienceCountry
      ? [{ label: t('req.audienceCountry'), value: o.country(d.audienceCountry) }]
      : []),
  ];
}
