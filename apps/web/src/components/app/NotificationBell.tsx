'use client';
import { Icon, Menu, Text, cn } from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useNotificationText } from '@/lib/hooks/notification-text';
import { useFormat } from '@/lib/hooks/format';
import type { NotificationDto, Paginated } from '@/lib/types';

const POLL_MS = 30_000;

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function NotificationBell() {
  const t = useTranslations('notifications');
  const f = useFormat();
  const text = useNotificationText();
  const qc = useQueryClient();
  const router = useRouter();
  const unread = useUnreadCount();
  const list = useQuery({
    queryKey: ['notifications', 'latest'],
    queryFn: () => api.get<Paginated<NotificationDto>>('/notifications', { page: 1, pageSize: 10 }),
    refetchInterval: POLL_MS,
  });
  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markOne = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const count = unread.data?.count ?? 0;

  return (
    <Menu
      align="end"
      className="w-[min(22rem,calc(100vw-2rem))] p-0"
      trigger={(p) => (
        <button
          type="button"
          onClick={p.toggle}
          aria-expanded={p['aria-expanded']}
          aria-haspopup={p['aria-haspopup']}
          aria-label={count ? t('bellUnread', { count }) : t('bell')}
          className="relative inline-flex size-11 items-center justify-center rounded-pill text-ink-muted hover:bg-primary-soft/60 hover:text-ink"
        >
          <Icon name="bell" size="md" />
          {count > 0 && (
            <span className="absolute right-1.5 top-1.5 inline-flex min-w-5 items-center justify-center rounded-pill bg-primary px-1 text-[11px] font-bold text-on-primary">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <Text size="small" weight="bold">
              {t('title')}
            </Text>
            {count > 0 && (
              <button type="button" onClick={() => markAll.mutate()} className="min-h-11 text-small font-bold text-primary-text hover:underline">
                {t('markAllRead')}
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {list.data?.items.length ? (
              list.data.items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.readAt) markOne.mutate(n.id);
                      close();
                      if (n.link) router.push(n.link);
                    }}
                    className={cn('flex w-full gap-2 border-b border-line px-4 py-2 text-left hover:bg-surface', !n.readAt && 'bg-primary-soft/40')}
                  >
                    <span className={cn('mt-2 size-2 shrink-0 rounded-pill', n.readAt ? 'bg-transparent' : 'bg-primary')} />
                    <span className="min-w-0">
                      <span className="block text-small font-bold text-ink">{text(n).title}</span>
                      <span className="line-clamp-2 block text-small text-ink-muted">{text(n).body}</span>
                      <span className="mt-1 block text-[11px] text-ink-muted">{f.relative(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-4 py-8 text-center text-small text-ink-muted">{t('empty')}</li>
            )}
          </ul>
          <Link href="/notifications" onClick={close} className="block px-4 py-3 text-center text-small font-bold text-primary-text hover:underline">
            {t('seeAll')}
          </Link>
        </div>
      )}
    </Menu>
  );
}
