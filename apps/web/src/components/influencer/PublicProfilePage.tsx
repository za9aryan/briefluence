'use client';
import { Alert, Stack } from '@briefluence/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useMe } from '@/lib/hooks/session';
import { InfluencerPublicProfile, type PublicInfluencer } from './PublicProfile';

export type PublicPage = PublicInfluencer & { live: boolean };

/**
 * The public page's content. Rendered on the server with the visitor's cookies; when that session
 * had expired, a signed-in visitor's browser refreshes it and loads their own view (a brand sees
 * stats and prices) right after.
 */
export function PublicProfilePage({ initial }: { initial: PublicPage }) {
  const t = useTranslations('portfolio.public');
  const { data: me } = useMe();
  const q = useQuery({
    queryKey: ['public-profile', initial.username],
    queryFn: () => api.get<PublicPage>(`/public/influencers/${initial.username}`),
    initialData: initial,
    initialDataUpdatedAt: 0,
    enabled: !!me && initial.access === 'guest',
  });
  const p = q.data;
  return (
    <Stack gap={6}>
      {!p.live && <Alert tone="warning">{t('notLive')}</Alert>}
      <InfluencerPublicProfile p={p} />
    </Stack>
  );
}
