'use client';
import type { ApplicationStatus, DealStatus } from '@briefluence/shared';
import { Avatar, Card, CardHeader, EmptyState, Grid, Inline, ScoreMeter, Skeleton, Stack, Stat, Text, buttonStyles, Icon } from '@briefluence/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { PageHeader } from '@/components/app/AppShell';
import { ApplicationStatusBadge } from '@/components/domain/badges';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/hooks/format';
import { useMe } from '@/lib/hooks/session';

interface BrandDashboardDto {
  deals: Record<DealStatus, number>;
  newApplicants7d: number;
  awaitingReview: number;
  recentApplicants: {
    id: string;
    status: ApplicationStatus;
    matchScore: number;
    createdAt: string;
    deal: { id: string; title: string };
    influencer: { id: string; displayName: string; avatarUrl: string | null };
  }[];
}

export default function BrandDashboardPage() {
  const t = useTranslations('dashboard');
  const tn = useTranslations('nav');
  const f = useFormat();
  const { data: me } = useMe();
  const q = useQuery({ queryKey: ['brand', 'dashboard'], queryFn: () => api.get<BrandDashboardDto>('/brands/me/dashboard') });
  const d = q.data;
  const totalDeals = d ? Object.values(d.deals).reduce((a, b) => a + b, 0) : 0;

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('hello', { name: me?.brand?.companyName ?? '' })}
        description={t('brandLead')}
        actions={
          <Link href="/brand/deals/new" className={buttonStyles({})}>
            <Icon name="plus" /> {tn('newDeal')}
          </Link>
        }
      />
      <Grid cols={{ base: 2, lg: 4 }} gap={{ base: 2, md: 4 }}>
        {!d ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-card" />)
        ) : (
          <>
            <Stat label={t('brand.active')} value={f.number(d.deals.ACTIVE)} icon="briefcase" />
            <Stat label={t('brand.awaiting')} value={f.number(d.awaitingReview)} icon="inbox" />
            <Stat label={t('brand.new7d')} value={f.number(d.newApplicants7d)} icon="users" />
            <Stat label={t('brand.drafts')} value={f.number(d.deals.DRAFT)} icon="edit" />
          </>
        )}
      </Grid>

      {d && totalDeals === 0 ? (
        <EmptyState
          icon="briefcase"
          title={t('brand.firstTitle')}
          description={t('brand.firstBody')}
          action={
            <Link href="/brand/deals/new" className={buttonStyles({})}>
              {tn('newDeal')}
            </Link>
          }
        />
      ) : (
        <Card>
          <CardHeader
            title={t('brand.recent')}
            actions={
              <Link href="/brand/deals" className="text-small font-bold text-primary-text hover:underline">
                {tn('deals')}
              </Link>
            }
          />
          {q.isLoading ? (
            <Skeleton className="h-40" />
          ) : d?.recentApplicants.length ? (
            <ul className="divide-y divide-line">
              {d.recentApplicants.map((a) => (
                <li key={a.id}>
                  <Link href={`/brand/deals/${a.deal.id}/applicants`} className="flex items-center gap-4 py-2 hover:bg-surface sm:px-2">
                    <Avatar name={a.influencer.displayName} src={a.influencer.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <Text weight="bold" truncate>
                        {a.influencer.displayName}
                      </Text>
                      <Text size="small" tone="muted" truncate>
                        {a.deal.title} · {f.relative(a.createdAt)}
                      </Text>
                    </div>
                    <Inline gap={2} className="shrink-0">
                      <span className="hidden sm:block">
                        <ApplicationStatusBadge status={a.status} />
                      </span>
                      <ScoreMeter size="sm" value={a.matchScore} label={t('match')} />
                    </Inline>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Text tone="muted">{t('brand.noApplicants')}</Text>
          )}
        </Card>
      )}
    </Stack>
  );
}
