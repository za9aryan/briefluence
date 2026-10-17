'use client';
import { isNotificationLocale, renderNotification } from '@briefluence/shared';
import { useLocale } from 'next-intl';
import type { NotificationDto } from '../types';

/**
 * Text of a notification in the current UI language, rendered from its type + params.
 * Older rows without params fall back to the text stored when they were created.
 */
export function useNotificationText() {
  const locale = useLocale();
  return (n: NotificationDto): { title: string; body: string } => {
    if (n.params && isNotificationLocale(locale)) {
      const r = renderNotification(n.type, n.params, locale);
      if (r) return { title: r.title, body: r.body };
    }
    return { title: n.title, body: n.body };
  };
}
