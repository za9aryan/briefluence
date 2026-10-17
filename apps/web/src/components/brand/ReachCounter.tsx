'use client';
import type { ReachPreviewInput } from '@briefluence/shared';
import { Icon, Text, cn } from '@briefluence/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** "About N verified bloggers match these filters" — debounced live preview. */
export function ReachCounter({ targeting, className }: { targeting: ReachPreviewInput; className?: string }) {
  const t = useTranslations('dealForm');
  const [debounced, setDebounced] = useState(targeting);
  const key = JSON.stringify(targeting);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(JSON.parse(key) as ReachPreviewInput), 400);
    return () => clearTimeout(id);
  }, [key]);
  const ready = (debounced.platforms?.length ?? 0) > 0 && (debounced.countries?.length ?? 0) > 0;
  const reach = useQuery({
    queryKey: ['reach', debounced],
    queryFn: () => api.post<{ count: number }>('/deals/preview-reach', debounced),
    enabled: ready,
    placeholderData: (prev) => prev,
  });
  const count = reach.data?.count;
  return (
    <div className={cn('flex items-center gap-4 rounded-card border border-primary/20 bg-primary-soft p-4 text-ink', className)} aria-live="polite">
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-primary text-on-primary">
        <Icon name={reach.isFetching ? 'spinner' : 'users'} spin={reach.isFetching} size="md" />
      </span>
      <div className="min-w-0">
        <Text size="label" className="text-ink-muted">
          {t('reachLabel')}
        </Text>
        <p className="text-h2 font-extrabold tabular-nums">{ready && count != null ? t('reachValue', { count }) : '—'}</p>
        {ready && count === 0 && <Text size="small" className="text-ink-muted">{t('reachZero')}</Text>}
      </div>
    </div>
  );
}
