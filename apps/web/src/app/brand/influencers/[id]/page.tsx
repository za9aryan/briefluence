'use client';
import { ErrorState, Skeleton, Stack } from '@briefluence/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import {
  InfluencerPublicProfile,
  type PublicInfluencer,
} from '@/components/influencer/PublicProfile';
import { api } from '@/lib/api';

export default function InfluencerProfileForBrandPage() {
  const { id } = useParams<{ id: string }>();
  const tc = useTranslations('common');
  const router = useRouter();
  const q = useQuery({
    queryKey: ['influencer', id],
    queryFn: () => api.get<PublicInfluencer>(`/influencers/${id}`),
  });

  if (q.isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (!q.data) return <ErrorState title={tc('notFoundTitle')} />;
  return (
    <Stack gap={6}>
      <button
        type="button"
        onClick={() => router.back()}
        className="self-start text-small font-bold text-primary-text hover:underline"
      >
        ← {tc('back')}
      </button>
      <InfluencerPublicProfile p={q.data} />
    </Stack>
  );
}
