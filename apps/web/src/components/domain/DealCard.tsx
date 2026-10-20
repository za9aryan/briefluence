'use client';
import {
  Badge,
  Card,
  CoverChip,
  Heading,
  Icon,
  Inline,
  MediaCover,
  ScoreMeter,
  Stack,
  Text,
} from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useFormat } from '@/lib/hooks/format';
import { PLATFORM_ICON } from '@/lib/hooks/options';
import type { FeedDealDto } from '@/lib/types';
import { BrandAvatar, isHiddenBrand, useBrandName } from './BrandIdentity';
import { ApplicationStatusBadge, CollaborationBadge } from './badges';
import { Compensation } from './Compensation';

/** Feed card: cover (brief image, else the brand logo) on top, then the promo card pattern. */
export function DealCard({ deal }: { deal: FeedDealDto }) {
  const t = useTranslations('deals');
  const tf = useTranslations('enums.contentFormat');
  const f = useFormat();
  const brandName = useBrandName();
  const city = deal.cities[0];
  return (
    <Card interactive p={0} className="relative flex flex-col overflow-hidden">
      <MediaCover
        src={deal.imageUrl}
        fallback={<DealCoverFallback brand={deal.brand} platforms={deal.platforms} />}
        topLeft={
          <CoverChip>
            {deal.platforms.map((p) => (
              <Icon key={p} name={PLATFORM_ICON[p]} size="xs" label={p} />
            ))}
            <span className="truncate">{deal.contentFormats.map((x) => tf(x)).join(', ')}</span>
          </CoverChip>
        }
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Inline justify="between" align="start" gap={4}>
          <Inline gap={2} className="min-w-0">
            <BrandAvatar brand={deal.brand} />
            <div className="min-w-0">
              <Text size="small" weight="bold" truncate>
                {brandName(deal.brand)}
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
            <Link
              href={`/influencer/deals/${deal.id}`}
              className="after:absolute after:inset-0 hover:text-primary-text"
            >
              {deal.title}
            </Link>
          </Heading>
          <Text size="small" tone="muted">
            {t('wanted', { count: deal.slots })}
          </Text>
        </Stack>

        <Inline gap={2} wrap>
          <CollaborationBadge type={deal.collaborationType} />
        </Inline>

        <Compensation compact {...deal} />

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <Inline gap={2}>
            <span
              className="inline-flex items-center gap-1 text-small text-ink-muted"
              title={t('viewsHint')}
            >
              <Icon name="eye" size="xs" />
              {f.compact(deal.viewCount)}
            </span>
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
      </div>
    </Card>
  );
}

/** Cover when a brief has no image: the brand logo, a lock (confidential), or the platform icon. */
export function DealCoverFallback({
  brand,
  platforms,
}: {
  brand: FeedDealDto['brand'];
  platforms: FeedDealDto['platforms'];
}) {
  if (brand.logoUrl && !isHiddenBrand(brand)) return <BrandAvatar brand={brand} size="lg" />;
  return (
    <Icon
      name={isHiddenBrand(brand) ? 'lock' : PLATFORM_ICON[platforms[0] ?? 'INSTAGRAM']}
      className="size-16 text-primary/25"
    />
  );
}
