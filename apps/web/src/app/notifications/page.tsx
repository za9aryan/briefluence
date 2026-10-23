'use client';
import { Button, Card, EmptyState, Pagination, Skeleton, Stack, Text, cn } from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { NotificationIcon } from '@/components/domain/NotificationIcon';
import { api } from '@/lib/api';
import { useNotificationText } from '@/lib/hooks/notification-text';
import { useFormat } from '@/lib/hooks/format';
import type { NotificationDto, Paginated } from '@/lib/types';

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const tc = useTranslations('common');
  const f = useFormat();
  const text = useNotificationText();
  const qc = useQueryClient();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ['notifications', 'page', page],
    queryFn: () => api.get<Paginated<NotificationDto>>('/notifications', { page, pageSize: 20 }),
    // The bell's live channel refreshes this list; the poll only covers a dropped connection.
    refetchInterval: 120_000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: invalidate,
  });
  const readOne = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: invalidate,
  });

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('title')}
        actions={
          <Button
            variant="secondary"
            size="sm"
            loading={readAll.isPending}
            onClick={() => readAll.mutate()}
          >
            {t('markAllRead')}
          </Button>
        }
      />
      {list.isLoading ? (
        <Skeleton className="h-64 rounded-card" />
      ) : !list.data?.items.length ? (
        <EmptyState icon="bell" title={t('empty')} />
      ) : (
        <Card p={0} className="overflow-hidden">
          <ul className="divide-y divide-line">
            {list.data.items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.readAt) readOne.mutate(n.id);
                    if (n.link) router.push(n.link);
                  }}
                  className={cn(
                    'flex w-full gap-4 px-4 py-4 text-left hover:bg-surface md:px-6',
                    !n.readAt && 'bg-primary-soft/40',
                  )}
                >
                  <span className="relative shrink-0">
                    <NotificationIcon type={n.type} />
                    {!n.readAt && (
                      <span className="absolute -right-0.5 -top-0.5 size-3 rounded-pill bg-primary ring-2 ring-surface-raised" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-ink">{text(n).title}</span>
                    <span className="block whitespace-pre-line text-small text-ink-muted">
                      {text(n).body}
                    </span>
                  </span>
                  <Text as="span" size="small" tone="muted" className="shrink-0">
                    {f.relative(n.createdAt)}
                  </Text>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {list.data && (
        <Pagination
          page={page}
          pageSize={list.data.pageSize}
          total={list.data.total}
          onChange={setPage}
          labels={{
            prev: tc('previous'),
            next: tc('next'),
            summary: tc('showing', {
              from: (page - 1) * list.data.pageSize + 1,
              to: Math.min(page * list.data.pageSize, list.data.total),
              total: list.data.total,
            }),
          }}
        />
      )}
    </Stack>
  );
}
