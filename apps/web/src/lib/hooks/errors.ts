'use client';
import { useTranslations } from 'next-intl';
import { ApiError } from '../api';

/** Translates API error codes into the user's language. */
export function useErrorMessage() {
  const t = useTranslations('errors');
  return (err: unknown): string => {
    if (err instanceof ApiError) {
      const key = `codes.${err.code}` as const;
      return t.has(key) ? t(key) : t('generic');
    }
    return t('network');
  };
}
