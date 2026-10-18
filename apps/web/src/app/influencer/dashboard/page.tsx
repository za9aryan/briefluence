'use client';
import type {
  ApplicationStatus,
  SubscriptionStatus,
  VerificationStatus,
} from '@briefluence/shared';
import {
  Card,
  CardHeader,
  EmptyState,
  Grid,
  Inline,
  Skeleton,
  Stack,
  Stat,
  Text,
} from '@briefluence/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { PageHeader } from '@/components/app/AppShell';
import { ApplicationStatusBadge } from '@/components/domain/badges';
import { useBrandName } from '@/components/domain/BrandIdentity';
import { DealCard } from '@/components/domain/DealCard';
import { BriefsChecklist } from '@/components/influencer/StartTrial';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/hooks/format';
import { useMe } from '@/lib/hooks/session';
import type { FeedDealDto, MyApplicationDto, Paginated } from '@/lib/types';

interface DashboardDto {
  applications: number;
  accepted: number;
  completed: number;
  byStatus: Record<ApplicationStatus, number>;
  profileViews: number;
  verificationStatus: VerificationStatus;
  trialDaysLeft: number;
  subscriptionStatus: SubscriptionStatus | null;
  hasAccess: boolean;
}

export default function InfluencerDashboardPage() {
  const t = useTranslations('dashboard');
  const tn = useTranslations('nav');
  const tp = useTranslations('billing.plans');
  const f = useFormat();
  const brandName = useBrandName();
  const { data: me } = useMe();
  const stats = useQuery({
    queryKey: ['influencer', 'dashboard'],
    queryFn: () => api.get<DashboardDto>('/influencers/me/dashboard'),
  });
  const approved = stats.data?.verificationStatus === 'APPROVED' && !!me?.subscription;
  const feed = useQuery({
    queryKey: ['feed', 'top'],
    queryFn: () => api.get<Paginated<FeedDealDto>>('/deals/feed', { pageSize: 3, sort: 'match' }),
    enabled: approved,
  });
  const apps = useQuery({
    queryKey: ['applications', 'mine'],
    queryFn: () => api.get<MyApplicationDto[]>('/applications/mine'),
  });
  const s = stats.data;

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('hello', { name: me?.influencer?.displayName.split(' ')[0] ?? '' })}
        description={t('influencerLead')}
      />

      <BriefsChecklist />

      <Grid cols={{ base: 2, lg: 4 }} gap={{ base: 2, md: 4 }}>
        {stats.isLoading || !s ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-card" />)
        ) : (
          <>
            <Stat label={t('stats.applications')} value={f.number(s.applications)} icon="send" />
            <Stat label={t('stats.accepted')} value={f.number(s.accepted)} icon="check-circle" />
            <Stat label={t('stats.profileViews')} value={f.number(s.profileViews)} icon="eye" />
            <Stat
              label={t('stats.plan')}
              value={
                !me?.subscription
                  ? '—'
                  : me.subscription.status === 'TRIALING'
                    ? t('stats.daysLeft', { count: me.subscription.trialDaysLeft })
                    : tp(`name.${me.subscription.planCode}`)
              }
              icon="card"
            />
          </>
        )}
      </Grid>

      {approved && (
        <Stack gap={4}>
          <Inline justify="between">
            <h2 className="text-h2 font-bold text-ink">{t('topMatches')}</h2>
            <Link
              href="/influencer/deals"
              className="text-small font-bold text-primary-text hover:underline"
            >
              {tn('findDeals')}
            </Link>
          </Inline>
          {feed.isLoading ? (
            <Grid cols={{ base: 1, md: 2, xl: 3 }} gap={6}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-64 rounded-card" />
              ))}
            </Grid>
          ) : feed.data?.items.length ? (
            <Grid cols={{ base: 1, md: 2, xl: 3 }} gap={6}>
              {feed.data.items.map((d) => (
                <DealCard key={d.id} deal={d} />
              ))}
            </Grid>
          ) : (
            <EmptyState
              icon="search"
              title={t('noMatchesTitle')}
              description={t('noMatchesBody')}
            />
          )}
        </Stack>
      )}

      <Card>
        <CardHeader
          title={t('recentApplications')}
          actions={
            <Link
              href="/influencer/applications"
              className="text-small font-bold text-primary-text hover:underline"
            >
              {tn('myApplications')}
            </Link>
          }
        />
        {apps.data?.length ? (
          <ul className="divide-y divide-line">
            {apps.data.slice(0, 5).map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Text weight="bold" truncate>
                    {a.deal.title}
                  </Text>
                  <Text size="small" tone="muted">
                    {brandName(a.deal.brand)} · {f.relative(a.updatedAt)}
                  </Text>
                </div>
                <ApplicationStatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        ) : (
          <Text tone="muted">{t('noApplications')}</Text>
        )}
      </Card>
    </Stack>
  );
}
