'use client';
import { Alert, Avatar, Card, CardHeader, ErrorState, Grid, Inline, Skeleton, Stack, Text } from '@briefluence/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { AccountLine, AccountStats } from '@/components/domain/AccountStats';
import { VerifiedBadge } from '@/components/domain/badges';
import { api } from '@/lib/api';
import { useOptions } from '@/lib/hooks/options';
import type { SocialAccountDto } from '@/lib/types';

interface PublicInfluencer {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  country: string;
  city: string | null;
  languages: string[];
  niches: string[];
  verified: boolean;
  socialAccounts: SocialAccountDto[];
  contacts: { email: string | null; phone: string | null; telegram: string | null } | null;
}

export default function InfluencerProfileForBrandPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('applications.brand');
  const tc = useTranslations('common');
  const router = useRouter();
  const o = useOptions();
  const q = useQuery({ queryKey: ['influencer', id], queryFn: () => api.get<PublicInfluencer>(`/influencers/${id}`) });

  if (q.isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (!q.data) return <ErrorState title={tc('notFoundTitle')} />;
  const p = q.data;
  return (
    <Stack gap={6}>
      <button type="button" onClick={() => router.back()} className="self-start text-small font-bold text-primary-text hover:underline">
        ← {tc('back')}
      </button>
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar size="xl" name={p.displayName} src={p.avatarUrl} />
          <Stack gap={1}>
            <Inline gap={2} wrap>
              <h1 className="text-h1 font-extrabold text-ink">{p.displayName}</h1>
              {p.verified && <VerifiedBadge />}
            </Inline>
            <Text tone="muted">{[p.city, o.country(p.country)].filter(Boolean).join(', ')}</Text>
            <Text size="small" tone="muted">
              {[p.niches.map(o.niche).join(', '), p.languages.map(o.language).join(', ')].filter(Boolean).join(' · ')}
            </Text>
          </Stack>
        </div>
        {p.bio && <Text className="mt-4">{p.bio}</Text>}
      </Card>
      {p.contacts ? (
        <Alert tone="success" title={t('contacts')}>
          {[p.contacts.phone, p.contacts.email, p.contacts.telegram].filter(Boolean).join(' · ')}
        </Alert>
      ) : (
        <Alert tone="info">{t('contactsHidden')}</Alert>
      )}
      <Grid cols={{ base: 1, md: 2 }} gap={6}>
        {p.socialAccounts.map((a) => (
          <Card key={a.id}>
            <CardHeader title={<AccountLine account={a} />} />
            <AccountStats account={a} />
          </Card>
        ))}
      </Grid>
    </Stack>
  );
}
