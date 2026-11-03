'use client';
import type { CityOption } from '@briefluence/shared';
import { Combobox } from '@briefluence/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { useOptions } from '@/lib/hooks/options';

interface FieldProps {
  id?: string;
  invalid?: boolean;
  describedBy?: string;
}

/** One country, searchable (all ~250, the launch markets first). */
export function CountrySelect({
  value,
  onChange,
  ...f
}: FieldProps & { value: string | null; onChange: (v: string | null) => void }) {
  const t = useTranslations('common');
  const o = useOptions();
  return (
    <Combobox
      id={f.id}
      invalid={f.invalid}
      aria-describedby={f.describedBy}
      options={o.allCountries}
      value={value}
      onChange={onChange}
      labelOf={o.country}
      placeholder={t('searchCountry')}
      emptyLabel={t('nothingFound')}
      removeLabel={t('remove')}
    />
  );
}

/** Several countries (brief targeting). */
export function CountriesSelect({
  value,
  onChange,
  ...f
}: FieldProps & { value: string[]; onChange: (v: string[]) => void }) {
  const t = useTranslations('common');
  const o = useOptions();
  return (
    <Combobox
      multiple
      id={f.id}
      invalid={f.invalid}
      aria-describedby={f.describedBy}
      options={o.allCountries}
      value={value}
      onChange={onChange}
      labelOf={o.country}
      placeholder={t('searchCountry')}
      emptyLabel={t('nothingFound')}
      removeLabel={t('remove')}
    />
  );
}

/** Cities in these countries matching what was typed, from our API (GET /geo/cities). */
function useCitySearch(countries: string[]) {
  const locale = useLocale();
  const [q, setQ] = useState('');
  const onQueryChange = useCallback((x: string) => setQ(x), []);
  const query = useQuery({
    queryKey: ['geo', 'cities', countries.join(','), q, locale],
    queryFn: () =>
      api.get<CityOption[]>('/geo/cities', { country: countries.join(','), q, lang: locale }),
    enabled: countries.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60 * 60 * 1000,
  });
  const options = (query.data ?? []).map((c) => ({
    value: c.name,
    label: c.label,
    hint: c.region ?? undefined,
  }));
  return { options, loading: query.isFetching, onQueryChange };
}

/** One city in a country (profiles). Stored by its English name. */
export function CitySelect({
  country,
  value,
  onChange,
  ...f
}: FieldProps & {
  country: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const t = useTranslations('common');
  const s = useCitySearch(country ? [country] : []);
  return (
    <Combobox
      id={f.id}
      invalid={f.invalid}
      aria-describedby={f.describedBy}
      value={value}
      onChange={onChange}
      {...s}
      disabled={!country}
      placeholder={t('searchCity')}
      emptyLabel={t('nothingFound')}
      removeLabel={t('remove')}
    />
  );
}

/** Several cities across the chosen countries (brief targeting). */
export function CitiesSelect({
  countries,
  value,
  onChange,
  ...f
}: FieldProps & { countries: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const t = useTranslations('common');
  const s = useCitySearch(countries);
  return (
    <Combobox
      multiple
      id={f.id}
      invalid={f.invalid}
      aria-describedby={f.describedBy}
      value={value}
      onChange={onChange}
      {...s}
      disabled={!countries.length}
      placeholder={t('searchCity')}
      emptyLabel={t('nothingFound')}
      removeLabel={t('remove')}
    />
  );
}
