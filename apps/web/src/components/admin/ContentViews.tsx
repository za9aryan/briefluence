'use client';
import { Avatar, Badge, DescriptionList, Inline, Stack, Text } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { CollaborationBadge, DealStatusBadge } from '@/components/domain/badges';
import { Compensation } from '@/components/domain/Compensation';
import { useDealRequirements } from '@/components/domain/dealRequirements';
import { OfferMeta, OfferPrice, OfferStatusBadge } from '@/components/offers/OfferParts';
import { useFormat } from '@/lib/hooks/format';
import { useOptions } from '@/lib/hooks/options';
import type { DealDto, OfferBloggerDto, OfferDto } from '@/lib/types';

export type AdminDeal = DealDto & {
  submittedAt: string | null;
  reviewNote: string | null;
  brand: {
    id: string;
    companyName: string;
    website: string | null;
    instagramUrl: string | null;
    user: { email: string };
  };
  applicantCount?: number;
};

export type AdminOffer = OfferDto & {
  blogger: OfferBloggerDto & { email: string };
  requestCount?: number;
};

function Cover({ src }: { src: string | null }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      className="aspect-video w-full max-w-md rounded-card border border-line object-cover"
    />
  );
}

function Body({ children }: { children: ReactNode }) {
  return (
    <Text size="small" className="whitespace-pre-line wrap-anywhere">
      {children}
    </Text>
  );
}

/** Everything in a brief, as the company wrote it: for review and for the admin's brief list. */
export function AdminDealContent({ deal: d }: { deal: AdminDeal }) {
  const t = useTranslations('admin.briefReview');
  const tr = useTranslations('deals');
  const f = useFormat();
  const requirements = useDealRequirements();
  return (
    <Stack gap={4}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <Stack gap={1} className="min-w-0">
          <Text size="body" weight="bold">
            {d.title}
          </Text>
          <Text size="small" tone="muted" className="wrap-anywhere">
            {[d.brand.companyName, d.brand.user.email, d.brand.website, d.brand.instagramUrl]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {d.submittedAt && (
            <Text size="small" tone="muted">
              {t('submitted', { date: f.dateTime(d.submittedAt) })}
            </Text>
          )}
        </Stack>
        <Inline gap={1} wrap>
          {d.isConfidential && <Badge icon="lock">{t('confidential')}</Badge>}
          <CollaborationBadge type={d.collaborationType} />
          <DealStatusBadge status={d.status} />
        </Inline>
      </div>
      <Cover src={d.imageUrl} />
      <Body>{d.description}</Body>
      <DescriptionList
        items={[
          { label: t('pays'), value: <Compensation {...d} /> },
          ...requirements(d),
          { label: t('slots'), value: String(d.slots) },
          { label: t('deadline'), value: f.date(d.applicationDeadline) },
          ...(d.publishBy ? [{ label: tr('publishBy'), value: f.date(d.publishBy) }] : []),
          ...(d.applicantCount != null
            ? [{ label: tr('applicantsLabel'), value: f.number(d.applicantCount) }]
            : []),
        ]}
      />
      {d.reviewNote && (
        <Text size="small" tone="muted">
          {t('previousReason', { reason: d.reviewNote })}
        </Text>
      )}
    </Stack>
  );
}

/** Everything in an influencer's offer: for review and for the admin's offer list. */
export function AdminOfferContent({ offer: o }: { offer: AdminOffer }) {
  const t = useTranslations('offers');
  const f = useFormat();
  const opts = useOptions();
  return (
    <Stack gap={4}>
      <Inline justify="between" align="start" gap={2}>
        <Inline gap={2} align="center" className="min-w-0">
          <Avatar name={o.blogger.displayName} src={o.blogger.avatarUrl} size="sm" />
          <Stack gap={0} className="min-w-0">
            <Text weight="bold">{o.title}</Text>
            <Text size="small" tone="muted" className="wrap-anywhere">
              {o.blogger.displayName} · {o.blogger.email}
              {o.submittedAt ? ` · ${f.dateTime(o.submittedAt)}` : ''}
            </Text>
          </Stack>
        </Inline>
        <Inline gap={1}>
          <CollaborationBadge type={o.collaborationType} />
          <OfferStatusBadge status={o.status} />
        </Inline>
      </Inline>
      <Cover src={o.imageUrl} />
      <OfferMeta offer={o} />
      <OfferPrice offer={o} size="body" />
      <Body>{o.description}</Body>
      {o.niches.length > 0 && (
        <Text size="small" tone="muted">
          {o.niches.map(opts.niche).join(', ')}
        </Text>
      )}
      {o.idealBrands && <Text size="small">{t('wantsToWorkWith', { value: o.idealBrands })}</Text>}
      {o.reviewNote && (
        <Text size="small" tone="muted">
          {t('review.rejected', { reason: o.reviewNote })}
        </Text>
      )}
    </Stack>
  );
}
