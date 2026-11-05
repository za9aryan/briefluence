'use client';
import type { ContentFormat, Currency, PaymentType, Platform } from '@briefluence/shared';
import {
  Badge,
  Card,
  Carousel,
  CoverChip,
  Heading,
  Icon,
  Inline,
  MediaCover,
  Stack,
  Text,
  buttonStyles,
} from '@briefluence/ui';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { INTL_LOCALE, type Locale } from '@/i18n/config';
import { PLATFORM_ICON } from '@/lib/hooks/options';
import { ExamplePrice } from './ExamplePrice';

/* Made-up examples for the homepage; texts live in messages (`showcase.*`), prices in USD and
   shown in the visitor's currency. */
type SampleBrief = {
  key: 'coffee' | 'hotel' | 'skincare' | 'bakery' | 'gym' | 'outdoor';
  payment: PaymentType;
  budget?: [number, number] | number;
  platform: Platform;
  formats: ContentFormat[];
  slots: number;
};
const BRIEFS: SampleBrief[] = [
  {
    key: 'coffee',
    payment: 'MONEY',
    budget: [300, 500],
    platform: 'INSTAGRAM',
    formats: ['REEL'],
    slots: 3,
  },
  { key: 'hotel', payment: 'BARTER', platform: 'INSTAGRAM', formats: ['REEL', 'STORY'], slots: 2 },
  {
    key: 'skincare',
    payment: 'MIXED',
    budget: 150,
    platform: 'INSTAGRAM',
    formats: ['REEL'],
    slots: 5,
  },
  { key: 'bakery', payment: 'BARTER', platform: 'INSTAGRAM', formats: ['STORY'], slots: 4 },
  {
    key: 'gym',
    payment: 'MONEY',
    budget: [200, 350],
    platform: 'INSTAGRAM',
    formats: ['REEL', 'STORY'],
    slots: 2,
  },
  {
    key: 'outdoor',
    payment: 'MIXED',
    budget: 150,
    platform: 'INSTAGRAM',
    formats: ['REEL'],
    slots: 3,
  },
];

type SampleOffer = {
  key: 'anna' | 'lukas' | 'marie' | 'dmitry' | 'giulia' | 'zofia';
  format: Extract<ContentFormat, 'STORY' | 'REEL'>;
  price: number;
  followers: number;
};
const OFFERS: SampleOffer[] = [
  { key: 'anna', format: 'STORY', price: 80, followers: 24_000 },
  { key: 'lukas', format: 'REEL', price: 250, followers: 41_000 },
  { key: 'marie', format: 'REEL', price: 200, followers: 18_000 },
  { key: 'dmitry', format: 'STORY', price: 60, followers: 12_000 },
  { key: 'giulia', format: 'REEL', price: 300, followers: 56_000 },
  { key: 'zofia', format: 'STORY', price: 50, followers: 9_000 },
];
const USD: Currency = 'USD';

const initials = (s: string) =>
  s
    .replace(/[«»"]/g, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

/** Two rows of sample cards: briefs companies post and offers bloggers sell. Nothing is clickable. */
export function Showcase() {
  const t = useTranslations('showcase');
  const tf = useTranslations('enums.contentFormat');
  const tp = useTranslations('enums.paymentType');
  const locale = useLocale() as Locale;
  const compact = new Intl.NumberFormat(INTL_LOCALE[locale], { notation: 'compact' });
  const carousel = {
    prevLabel: t('previous'),
    nextLabel: t('next'),
    itemClassName: 'w-64 sm:w-72',
  };

  return (
    <Stack gap={12}>
      <Stack gap={4}>
        <Row title={t('briefsTitle')} cta={t('briefsCta')} href="/signup?role=BRAND" />
        <Carousel label={t('briefsTitle')} {...carousel}>
          {BRIEFS.map((b) => {
            const brand = t(`briefs.${b.key}.brand`);
            return (
              <Card key={b.key} p={0} className="flex h-full flex-col overflow-hidden">
                <MediaCover
                  fallback={
                    <span className="text-display font-extrabold text-primary-text" aria-hidden>
                      {initials(brand)}
                    </span>
                  }
                  topLeft={
                    <CoverChip>
                      <Icon name={PLATFORM_ICON[b.platform]} size="xs" label={b.platform} />
                      <span className="truncate">{b.formats.map((x) => tf(x)).join(', ')}</span>
                    </CoverChip>
                  }
                  topRight={<Badge variant="small">{t('sample')}</Badge>}
                />
                <Stack gap={2} className="flex-1 p-4">
                  <Text size="small" tone="muted" truncate>
                    <Text as="span" size="small" weight="bold" tone="default">
                      {brand}
                    </Text>{' '}
                    · {t(`briefs.${b.key}.city`)}
                  </Text>
                  <Heading level={3} className="line-clamp-2">
                    {t(`briefs.${b.key}.title`)}
                  </Heading>
                  <Text size="small" tone="muted">
                    {t('wanted', { count: b.slots })}
                  </Text>
                  <div className="mt-auto border-t border-line pt-3">
                    <Inline gap={2} wrap>
                      {b.payment !== 'MONEY' && <Badge tone="barter">{tp('BARTER')}</Badge>}
                      {b.budget != null && (
                        <Text as="span" weight="bold">
                          {Array.isArray(b.budget) ? (
                            <ExamplePrice amount={b.budget[0]} to={b.budget[1]} currency={USD} />
                          ) : (
                            <ExamplePrice amount={b.budget} currency={USD} />
                          )}
                        </Text>
                      )}
                      {b.payment !== 'MONEY' && (
                        <Text as="span" size="small" tone="muted">
                          {t(`briefs.${b.key}.barter`)}
                        </Text>
                      )}
                    </Inline>
                  </div>
                </Stack>
              </Card>
            );
          })}
        </Carousel>
      </Stack>

      <Stack gap={4}>
        <Row title={t('offersTitle')} cta={t('offersCta')} href="/signup?role=INFLUENCER" />
        <Carousel label={t('offersTitle')} {...carousel}>
          {OFFERS.map((o) => {
            const name = t(`offers.${o.key}.name`);
            return (
              <Card key={o.key} p={0} className="flex h-full flex-col overflow-hidden">
                <MediaCover
                  aspect="photo"
                  fallback={
                    <span className="text-display font-extrabold text-primary-text" aria-hidden>
                      {initials(name)}
                    </span>
                  }
                  topLeft={
                    <CoverChip>
                      <Icon name="instagram" size="xs" label="INSTAGRAM" />
                      {tf(o.format)}
                    </CoverChip>
                  }
                  topRight={<Badge variant="small">{t('sample')}</Badge>}
                />
                <Stack gap={2} className="flex-1 p-4">
                  <Text size="small" tone="muted" truncate>
                    <Text as="span" size="small" weight="bold" tone="default">
                      {name}
                    </Text>{' '}
                    · {t(`offers.${o.key}.city`)}
                  </Text>
                  <Heading level={3} className="line-clamp-2">
                    {t(`offers.${o.key}.title`)}
                  </Heading>
                  <Text size="small" tone="muted">
                    {t('followers', { count: compact.format(o.followers) })}
                  </Text>
                  <div className="mt-auto border-t border-line pt-3">
                    <span className="text-h2 font-extrabold text-ink">
                      <ExamplePrice amount={o.price} currency={USD} />
                    </span>
                  </div>
                </Stack>
              </Card>
            );
          })}
        </Carousel>
      </Stack>
    </Stack>
  );
}

function Row({ title, cta, href }: { title: string; cta: string; href: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <Heading level={3} size="h2">
        {title}
      </Heading>
      <Link
        href={href}
        className={buttonStyles({
          variant: 'link',
          className: 'self-start whitespace-normal text-left',
        })}
      >
        {cta} <Icon name="arrow-right" />
      </Link>
    </div>
  );
}
