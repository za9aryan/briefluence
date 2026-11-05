'use client';
import type { ContentFormat, PaymentType, Platform } from '@briefluence/shared';
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
  cn,
} from '@briefluence/ui';
import { useLocale, useTranslations } from 'next-intl';
import { INTL_LOCALE, type Locale } from '@/i18n/config';
import { PLATFORM_ICON } from '@/lib/hooks/options';
import { ExamplePrice } from './ExamplePrice';

/**
 * Marketing copies of the feed's brief card (`DealCard`) and the offer card, filled with made-up
 * data. Decorative: nothing inside is clickable. Photos are CC0 (public/showcase/SOURCES.json).
 */
export function SampleBriefCard({
  image,
  brand,
  meta,
  title,
  slots,
  match,
  payment,
  budget,
  barter,
  platform = 'INSTAGRAM',
  formats,
  views,
  applicants,
  className,
}: {
  image: string;
  brand: string;
  /** City and age of the brief, e.g. "Tyrol · 2 days ago". */
  meta: string;
  title: string;
  slots: number;
  match: number;
  payment: PaymentType;
  /** USD, shown in the visitor's currency. */
  budget?: number | [number, number];
  barter?: string;
  platform?: Platform;
  formats: ContentFormat[];
  views: number;
  applicants: number;
  className?: string;
}) {
  const t = useTranslations('deals');
  const tf = useTranslations('enums.contentFormat');
  const tp = useTranslations('enums.paymentType');
  const ts = useTranslations('promo');
  const locale = useLocale() as Locale;
  const compact = new Intl.NumberFormat(INTL_LOCALE[locale], { notation: 'compact' });
  return (
    <Card
      p={0}
      aria-hidden
      className={cn(
        'pointer-events-none flex select-none flex-col overflow-hidden shadow-pop',
        className,
      )}
    >
      <MediaCover
        src={image}
        topLeft={
          <CoverChip>
            <Icon name={PLATFORM_ICON[platform]} size="xs" label={platform} />
            <span className="truncate">{formats.map((x) => tf(x)).join(', ')}</span>
          </CoverChip>
        }
        topRight={<CoverChip>{ts('sample')}</CoverChip>}
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Inline justify="between" align="start" gap={4}>
          <Inline gap={2} className="min-w-0">
            <Initials name={brand} />
            <div className="min-w-0">
              <Text size="small" weight="bold" truncate>
                {brand}
              </Text>
              <Text size="small" tone="muted" truncate>
                {meta}
              </Text>
            </div>
          </Inline>
          <ScoreMeter value={match} label={t('match')} />
        </Inline>

        <Stack gap={1}>
          <Heading level={3}>{title}</Heading>
          <Text size="small" tone="muted">
            {t('wanted', { count: slots })}
          </Text>
        </Stack>

        <Inline gap={2} wrap>
          {payment !== 'MONEY' && <Badge tone="barter">{tp('BARTER')}</Badge>}
          {budget != null && (
            <Text as="span" weight="bold">
              {Array.isArray(budget) ? (
                <ExamplePrice amount={budget[0]} to={budget[1]} currency="USD" />
              ) : (
                <ExamplePrice amount={budget} currency="USD" />
              )}
            </Text>
          )}
          {barter && (
            <Text as="span" size="small" tone="muted">
              {barter}
            </Text>
          )}
        </Inline>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <span className="inline-flex items-center gap-1 text-small text-ink-muted">
            <Icon name="eye" size="xs" />
            {compact.format(views)}
          </span>
          <Text as="span" size="small" tone="muted" className="whitespace-nowrap">
            {t('applicants', { count: applicants })}
          </Text>
        </div>
      </div>
    </Card>
  );
}

export function SampleOfferCard({
  image,
  name,
  meta,
  title,
  body,
  format,
  price,
  className,
}: {
  image: string;
  name: string;
  meta: string;
  title: string;
  body?: string;
  format: ContentFormat;
  /** USD, shown in the visitor's currency. */
  price: number;
  className?: string;
}) {
  const tf = useTranslations('enums.contentFormat');
  const ts = useTranslations('promo');
  return (
    <Card
      p={0}
      aria-hidden
      className={cn(
        'pointer-events-none flex select-none flex-col overflow-hidden shadow-pop',
        className,
      )}
    >
      <MediaCover
        src={image}
        topLeft={
          <CoverChip>
            <Icon name="instagram" size="xs" label="INSTAGRAM" />
            {tf(format)}
          </CoverChip>
        }
        topRight={<CoverChip>{ts('sample')}</CoverChip>}
      />
      <Stack gap={2} className="flex-1 p-4">
        <Inline gap={2} className="min-w-0">
          <Initials name={name} />
          <div className="min-w-0">
            <Text size="small" weight="bold" truncate>
              {name}
            </Text>
            <Text size="small" tone="muted" truncate>
              {meta}
            </Text>
          </div>
        </Inline>
        <Heading level={3}>{title}</Heading>
        {body && (
          <Text size="small" tone="muted">
            {body}
          </Text>
        )}
        <div className="mt-auto border-t border-line pt-3">
          <span className="text-h2 font-extrabold text-ink">
            <ExamplePrice amount={price} currency="USD" />
          </span>
        </div>
      </Stack>
    </Card>
  );
}

/** Round avatar with a name's initials (sample cards have no profile photos). */
export function Initials({ name }: { name: string }) {
  const letters = name
    .replace(/[«»"“”]/g, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <span
      aria-hidden
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-pill bg-primary-soft text-small font-extrabold text-primary-text"
    >
      {letters}
    </span>
  );
}
