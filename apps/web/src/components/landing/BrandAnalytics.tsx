'use client';
import {
  Badge,
  Card,
  Container,
  Eyebrow,
  Flag,
  Grid,
  Heading,
  Icon,
  IconBubble,
  Inline,
  ScoreMeter,
  ShareRow,
  SplitBar,
  Stack,
  Text,
  buttonStyles,
  cn,
  type IconName,
} from '@briefluence/ui';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { INTL_LOCALE, type Locale } from '@/i18n/config';
import { useOptions } from '@/lib/hooks/options';
import css from './Promo.module.css';

/* Made-up sample account (texts in `promo.analytics.card`). */
const SAMPLE = {
  followers: 24_300,
  avgViews: 9_800,
  er: 0.046,
  posts: 412,
  match: 92,
  age: [
    ['13–17', 4],
    ['18–24', 31],
    ['25–34', 40],
    ['35–44', 17],
    ['45+', 8],
  ] as const,
  women: 68,
  countries: [
    ['RU', 64],
    ['DE', 9],
    ['FR', 6],
  ] as const,
};

/**
 * /for-brands: what a company sees about an influencer, as an illustration (a sample stats card
 * with floating match score and audience callouts) next to three plain points.
 */
export function BrandAnalytics({ cta }: { cta: string }) {
  const t = useTranslations('promo.analytics');
  const tp = useTranslations('promo');
  const tb = useTranslations('landing.brands');
  const locale = useLocale() as Locale;
  const intl = INTL_LOCALE[locale];
  const compact = new Intl.NumberFormat(intl, { notation: 'compact', maximumFractionDigits: 1 });
  const pct = (v: number) =>
    new Intl.NumberFormat(intl, { style: 'percent', maximumFractionDigits: 1 }).format(v);
  const o = useOptions();
  const core = SAMPLE.age[1][1] + SAMPLE.age[2][1];
  const top = Math.max(...SAMPLE.age.map(([, v]) => v));

  const kpis: [IconName, string, string][] = [
    ['users', t('card.followers'), compact.format(SAMPLE.followers)],
    ['eye', t('card.avgViews'), compact.format(SAMPLE.avgViews)],
    ['heart', t('card.er'), pct(SAMPLE.er)],
    ['image', t('card.posts'), compact.format(SAMPLE.posts)],
  ];

  return (
    <section>
      <Container size="lg" py={{ base: 8, md: 16 }}>
        <Grid cols={{ base: 1, lg: 2 }} gap={{ base: 8, lg: 12 }} className="items-center">
          <Stack gap={6} align="start">
            <Stack gap={2}>
              <Eyebrow>{t('eyebrow')}</Eyebrow>
              <Heading level={2}>{t('title')}</Heading>
              <Text tone="muted">{t('lead')}</Text>
            </Stack>
            <Stack gap={4}>
              {(
                [
                  ['official', 'shield'],
                  ['audience', 'users'],
                  ['match', 'target'],
                ] as const
              ).map(([k, icon]) => (
                <Inline key={k} gap={4} align="start">
                  <IconBubble name={icon} tone="primary" />
                  <Text className="pt-2">{t(`points.${k}`)}</Text>
                </Inline>
              ))}
            </Stack>
            <Link href={cta} className={buttonStyles({ size: 'lg' })}>
              {tb('cta')}
            </Link>
          </Stack>

          {/* Decorative: the sample data is described by the points on the left. */}
          <div
            aria-hidden
            className={cn(
              css.stage,
              'pointer-events-none select-none rounded-lg px-4 py-8 sm:px-10 sm:py-12',
            )}
          >
            <div className="relative mx-auto max-w-sm">
              <Card p={0} className="overflow-hidden shadow-pop">
                <div
                  className="h-24 bg-cover bg-center sm:h-28"
                  style={{ backgroundImage: 'url(/showcase/creator-cover.webp)' }}
                />
                <div className="flex flex-col gap-4 p-4 sm:p-6">
                  <div className="-mt-12 flex items-end justify-between gap-2 sm:-mt-14">
                    <span className="inline-flex size-16 items-center justify-center rounded-pill bg-primary text-h2 font-extrabold text-on-primary ring-4 ring-surface-raised">
                      AS
                    </span>
                    <Badge tone="primary">{tp('sample')}</Badge>
                  </div>
                  <div>
                    <Inline gap={2} wrap>
                      <Text weight="bold">{t('card.name')}</Text>
                      <Badge variant="small" tone="success" icon="verified">
                        {t('card.verified')}
                      </Badge>
                    </Inline>
                    <Text size="small" tone="muted">
                      <Icon name="instagram" size="xs" className="mr-1 inline" />
                      @anna.eats · {t('card.city')} · {t('card.niche')}
                    </Text>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {kpis.map(([icon, label, value]) => (
                      <div
                        key={label}
                        className="flex items-center gap-2 rounded-sm bg-surface p-2"
                      >
                        <IconBubble
                          name={icon}
                          size="sm"
                          tone="primary"
                          className="hidden sm:inline-flex"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-small text-ink-muted">{label}</p>
                          <p className="whitespace-nowrap text-body font-bold tabular-nums text-ink">
                            {value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="mb-2 text-small font-bold text-ink">{t('card.age')}</p>
                    <div className="flex h-24 items-end gap-2">
                      {SAMPLE.age.map(([label, v], i) => (
                        <div key={label} className="flex h-full flex-1 flex-col items-center gap-1">
                          <div className="flex w-full flex-1 items-end">
                            <span
                              className={cn(
                                css.bar,
                                'block w-full rounded-t-sm',
                                v === top ? 'bg-primary' : 'bg-primary/40',
                              )}
                              style={{
                                height: `${(v / top) * 100}%`,
                                animationDelay: `${i * 90}ms`,
                              }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums text-ink-muted">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <SplitBar
                    label={t('card.gender')}
                    left={{
                      icon: 'user',
                      label: t('card.women'),
                      percent: SAMPLE.women,
                      value: pct(SAMPLE.women / 100),
                    }}
                    right={{
                      icon: 'user',
                      label: t('card.men'),
                      percent: 100 - SAMPLE.women,
                      value: pct((100 - SAMPLE.women) / 100),
                    }}
                  />

                  <Stack gap={2}>
                    <p className="text-small font-bold text-ink">{t('card.countries')}</p>
                    {SAMPLE.countries.map(([code, v], i) => (
                      <ShareRow
                        key={code}
                        strong={i === 0}
                        leading={<Flag code={code} className="h-3 w-4 rounded-[2px]" />}
                        label={o.country(code)}
                        percent={v}
                        value={pct(v / 100)}
                      />
                    ))}
                  </Stack>
                </div>
              </Card>

              {/* Floating callouts: in the flow on phones, around the card from sm up. */}
              <div className="mt-4 flex flex-wrap gap-2 sm:mt-0 sm:block">
                <Card
                  p={4}
                  className={cn(
                    css.float,
                    'flex items-center gap-4 shadow-pop sm:absolute sm:-right-12 sm:top-6',
                  )}
                >
                  <ScoreMeter value={SAMPLE.match} label={t('card.match')} />
                  <Text size="small" weight="bold" className="max-w-28">
                    {t('card.match')}
                  </Text>
                </Card>
                <span
                  className={cn(
                    css.floatSlow,
                    'inline-flex items-center gap-2 rounded-pill bg-ink px-4 py-2 text-small font-bold text-surface shadow-pop sm:absolute sm:-bottom-5 sm:-left-10',
                  )}
                >
                  <Icon name="target" size="xs" />
                  {t('card.core', { percent: pct(core / 100) })}
                </span>
                <span
                  className={cn(
                    css.float,
                    'inline-flex items-center gap-2 rounded-pill bg-surface-raised px-4 py-2 text-small font-bold text-ink shadow-pop sm:absolute sm:-left-10 sm:top-4',
                  )}
                >
                  <Icon name="check-circle" size="xs" tone="success" />
                  {t('card.synced')}
                </span>
              </div>
            </div>
          </div>
        </Grid>
      </Container>
    </section>
  );
}
