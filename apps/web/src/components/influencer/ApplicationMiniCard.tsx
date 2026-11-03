'use client';
import { Icon, Inline, MediaCover, Text } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ApplicationStatusBadge } from '@/components/domain/badges';
import { isHiddenBrand, useBrandName } from '@/components/domain/BrandIdentity';
import { Compensation } from '@/components/domain/Compensation';
import { dealCover } from '@/components/domain/DealCard';
import { useFormat } from '@/lib/hooks/format';
import { PLATFORM_ICON } from '@/lib/hooks/options';
import type { MyApplicationDto } from '@/lib/types';

/**
 * One application in a short list (dashboard): small brief image on the left; title, company,
 * pay and status on the right. Opens the brief, which shows the application's progress.
 */
export function ApplicationMiniCard({ app }: { app: MyApplicationDto }) {
  const tf = useTranslations('enums.contentFormat');
  const brandName = useBrandName();
  const f = useFormat();
  const d = app.deal;
  return (
    <Link
      href={`/influencer/deals/${d.id}`}
      className="group flex items-center gap-3 rounded-card border border-line bg-surface-raised p-2.5 pr-3 transition-colors hover:border-primary/40 sm:gap-4"
    >
      <MediaCover
        src={dealCover(d)}
        alt=""
        className="aspect-square size-20 shrink-0 rounded-[12px] sm:size-24"
        fallback={
          <Icon
            name={isHiddenBrand(d.brand) ? 'lock' : PLATFORM_ICON[d.platforms[0] ?? 'INSTAGRAM']}
            className="size-8 text-primary/30"
          />
        }
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Text weight="bold" clamp={2} className="wrap-anywhere">
          {d.title}
        </Text>
        <Text size="small" tone="muted" truncate>
          {brandName(d.brand)} · {d.contentFormats.map((x) => tf(x)).join(', ')}
        </Text>
        <Inline gap={2} wrap className="mt-1">
          <ApplicationStatusBadge status={app.status} />
          <span className="text-small">
            <Compensation
              compact
              paymentType={d.paymentType}
              budgetMin={app.proposedPrice ?? d.budgetMin}
              budgetMax={app.proposedPrice ?? d.budgetMax}
              currency={d.currency}
              barterDescription={d.barterDescription}
            />
          </span>
        </Inline>
        <Text size="small" tone="muted">
          {f.relative(app.updatedAt)}
        </Text>
      </div>
      <Icon
        name="chevron-right"
        tone="muted"
        className="hidden shrink-0 transition-transform group-hover:translate-x-0.5 sm:block"
      />
    </Link>
  );
}
