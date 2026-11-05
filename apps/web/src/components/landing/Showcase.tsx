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
  cn,
  type IconName,
} from '@briefluence/ui';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { INTL_LOCALE, type Locale } from '@/i18n/config';
import { PLATFORM_ICON } from '@/lib/hooks/options';
import { ExamplePrice } from './ExamplePrice';
import css from './Showcase.module.css';

/* Made-up examples for the homepage; texts live in messages (`showcase.*`), prices in USD and
   shown in the visitor's currency. Photos in public/showcase are CC0 (see SOURCES.json there). */
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

/**
 * Two framed panels of sample cards: briefs companies post (soft tint) and offers influencers sell
 * (ink panel). Nothing on a card is clickable; each panel has one sign-up button.
 */
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
    <Stack gap={6}>
      <Panel
        tone="briefs"
        icon="building"
        label={t('forCompanies')}
        title={t('briefsTitle')}
        lead={t('briefsLead')}
        action={
          <Link href="/signup?role=BRAND" className={buttonStyles({})}>
            {t('briefsCta')} <Icon name="arrow-right" />
          </Link>
        }
      >
        <Carousel label={t('briefsTitle')} {...carousel}>
          {BRIEFS.map((b) => (
            <Card key={b.key} p={0} className="flex h-full flex-col overflow-hidden shadow-pop">
              <MediaCover
                src={`/showcase/${b.key}.webp`}
                topLeft={
                  <CoverChip>
                    <Icon name={PLATFORM_ICON[b.platform]} size="xs" label={b.platform} />
                    <span className="truncate">{b.formats.map((x) => tf(x)).join(', ')}</span>
                  </CoverChip>
                }
                topRight={<CoverChip>{t('sample')}</CoverChip>}
              />
              <Stack gap={2} className="flex-1 p-4">
                <Inline gap={2} className="min-w-0">
                  <Initials name={t(`briefs.${b.key}.brand`)} />
                  <Text size="small" tone="muted" truncate>
                    <Text as="span" size="small" weight="bold" tone="default">
                      {t(`briefs.${b.key}.brand`)}
                    </Text>{' '}
                    · {t(`briefs.${b.key}.city`)}
                  </Text>
                </Inline>
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
          ))}
        </Carousel>
      </Panel>

      <Panel
        tone="offers"
        icon="user"
        label={t('forInfluencers')}
        title={t('offersTitle')}
        lead={t('offersLead')}
        action={
          <Link
            href="/signup?role=INFLUENCER"
            className={buttonStyles({ className: 'bg-surface text-ink hover:bg-surface-raised' })}
          >
            {t('offersCta')} <Icon name="arrow-right" />
          </Link>
        }
      >
        <Carousel label={t('offersTitle')} {...carousel}>
          {OFFERS.map((o) => (
            <Card key={o.key} p={0} className="flex h-full flex-col overflow-hidden">
              <MediaCover
                aspect="photo"
                src={`/showcase/${o.key}.webp`}
                topLeft={
                  <CoverChip>
                    <Icon name="instagram" size="xs" label="INSTAGRAM" />
                    {tf(o.format)}
                  </CoverChip>
                }
                topRight={<CoverChip>{t('sample')}</CoverChip>}
              />
              <Stack gap={2} className="flex-1 p-4">
                <Inline gap={2} className="min-w-0">
                  <Initials name={t(`offers.${o.key}.name`)} />
                  <div className="min-w-0">
                    <Text size="small" weight="bold" truncate>
                      {t(`offers.${o.key}.name`)}
                    </Text>
                    <Text size="small" tone="muted">
                      {t(`offers.${o.key}.city`)} ·{' '}
                      {t('followers', { count: compact.format(o.followers) })}
                    </Text>
                  </div>
                </Inline>
                <Heading level={3} className="line-clamp-2">
                  {t(`offers.${o.key}.title`)}
                </Heading>
                <div className="mt-auto border-t border-line pt-3">
                  <span className="text-h2 font-extrabold text-ink">
                    <ExamplePrice amount={o.price} currency={USD} />
                  </span>
                </div>
              </Stack>
            </Card>
          ))}
        </Carousel>
      </Panel>
    </Stack>
  );
}

function Panel({
  tone,
  icon,
  label,
  title,
  lead,
  action,
  children,
}: {
  tone: 'briefs' | 'offers';
  icon: IconName;
  label: string;
  title: string;
  lead: string;
  action: ReactNode;
  children: ReactNode;
}) {
  const dark = tone === 'offers';
  return (
    <div className={cn(css.panel, css[tone], 'rounded-lg px-4 py-6 sm:p-8 lg:p-12')}>
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
        <Stack gap={2} align="start" className="max-w-xl">
          <span className={css.label}>
            <Icon name={icon} size="xs" /> {label}
          </span>
          <Heading level={3} size={{ base: 'h2', md: 'h1' }} className={dark ? 'text-surface' : ''}>
            {title}
          </Heading>
          <Text className={dark ? css.offersMuted : 'text-ink-muted'}>{lead}</Text>
        </Stack>
        <div className="shrink-0 [&>a]:w-full sm:[&>a]:w-auto">{action}</div>
      </div>
      {children}
    </div>
  );
}

/** Round avatar with a name's initials (sample cards have no profile photos). */
function Initials({ name }: { name: string }) {
  const letters = name
    .replace(/[«»"]/g, '')
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
