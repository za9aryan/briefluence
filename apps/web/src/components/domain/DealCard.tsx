'use client';
import { Avatar, Badge, Card, Heading, Icon, Inline, ScoreMeter, Stack, Text } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useFormat } from '@/lib/hooks/format';
import { PLATFORM_ICON } from '@/lib/hooks/options';
import type { FeedDealDto } from '@/lib/types';
import { ApplicationStatusBadge } from './badges';
import { Compensation } from './Compensation';

/** Feed card, following the brand book's promo card pattern. */
export function DealCard({ deal }: { deal: FeedDealDto }) {
  const t = useTranslations('deals');
  const tf = useTranslations('enums.contentFormat');
  const f = useFormat();
  const city = deal.cities[0];
  return (
    <Card interactive p={4} className="relative flex flex-col gap-4">
      <Inline justify="between" align="start" gap={4}>
        <Inline gap={2} className="min-w-0">
          <Avatar square size="md" name={deal.brand.companyName} src={deal.brand.logoUrl} />
          <div className="min-w-0">
            <Text size="small" weight="bold" truncate>
              {deal.brand.companyName}
            </Text>
            <Text size="small" tone="muted" truncate>
              {[city, f.relative(deal.publishedAt ?? deal.createdAt)].filter(Boolean).join(' · ')}
            </Text>
          </div>
        </Inline>
        <ScoreMeter value={deal.matchScore} label={t('match')} />
      </Inline>

      <Stack gap={1}>
        <Heading level={3}>
          <Link href={`/influencer/deals/${deal.id}`} className="after:absolute after:inset-0 hover:text-primary-text">
            {deal.title}
          </Link>
        </Heading>
        <Text size="small" tone="muted">
          {t('wanted', { count: deal.slots })} · {deal.contentFormats.map((x) => tf(x)).join(', ')}
        </Text>
      </Stack>

      <Compensation compact {...deal} />

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <Inline gap={1}>
          {deal.platforms.map((p) => (
            <Icon key={p} name={PLATFORM_ICON[p]} tone="muted" label={p} />
          ))}
        </Inline>
        <Inline gap={2} wrap>
          {deal.myApplication ? (
            <ApplicationStatusBadge status={deal.myApplication.status} />
          ) : (
            <Badge variant="small" icon="clock">
              {t('deadline', { date: f.date(deal.applicationDeadline) })}
            </Badge>
          )}
          <Text as="span" size="small" tone="muted" className="whitespace-nowrap">
            {t('applicants', { count: deal.applicantCount })}
          </Text>
        </Inline>
      </div>
    </Card>
  );
}
