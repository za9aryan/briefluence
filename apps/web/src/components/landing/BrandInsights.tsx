'use client';
import {
  Badge,
  Card,
  Container,
  Heading,
  Icon,
  IconBubble,
  Inline,
  Stack,
  Text,
  buttonStyles,
  cn,
} from '@briefluence/ui';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { INTL_LOCALE, type Locale } from '@/i18n/config';
import { useOptions } from '@/lib/hooks/options';
import css from './Promo.module.css';

/* Made-up sample of the brand Insights page (/brand/insights): what influencers searched for and
   which briefs they opened over 30 days. Two series share one axis and one unit. */
const SEARCHES = [
  182, 175, 190, 214, 248, 262, 231, 198, 192, 205, 229, 266, 281, 244, 210, 206, 221, 247, 289,
  301, 262, 228, 219, 236, 262, 305, 322, 284, 251, 268,
];
const OPENS = [
  96, 90, 101, 118, 139, 151, 128, 109, 104, 113, 127, 152, 166, 139, 117, 114, 125, 141, 170, 183,
  151, 129, 124, 135, 152, 181, 196, 167, 146, 158,
];
const PEAK = 19;
const PLATFORMS = [
  ['INSTAGRAM', 62],
  ['TIKTOK', 27],
  ['YOUTUBE', 11],
] as const;
const NICHES = [
  ['food', 34],
  ['travel', 22],
  ['beauty', 18],
  ['fitness', 12],
] as const;
const BARTER = 42;
const ACTIVE = 1284;

/* Chart geometry (SVG user units; stretched to the card width). */
const W = 300;
const H = 120;
const MAX = 350;
const x = (i: number) => (i / (SEARCHES.length - 1)) * W;
const y = (v: number) => H - (v / MAX) * H;

/** Smooth line through the points (Catmull-Rom as cubic Béziers). */
function smooth(values: readonly number[]) {
  const p = values.map((v, i) => [x(i), y(v)] as const);
  let d = `M${p[0]![0]},${p[0]![1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const [x0, y0] = p[i - 1] ?? p[i]!;
    const [x1, y1] = p[i]!;
    const [x2, y2] = p[i + 1]!;
    const [x3, y3] = p[i + 2] ?? p[i + 1]!;
    d += ` C${x1 + (x2 - x0) / 6},${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6},${y2 - (y3 - y1) / 6} ${x2},${y2}`;
  }
  return d;
}
const area = (line: string) => `${line} L${W},${H} L0,${H} Z`;

/**
 * /for-brands: the Insights page as an illustration. A trend card with two overlapping area series,
 * and smaller cards (platforms donut, top niches, money or barter) layered over its corners.
 */
export function BrandInsights({ cta }: { cta: string }) {
  const t = useTranslations('promo.insights');
  const ti = useTranslations('insights');
  const tb = useTranslations('landing.brands');
  const tf = useTranslations('enums');
  const tp = useTranslations('promo');
  const o = useOptions();
  const locale = useLocale() as Locale;
  const intl = INTL_LOCALE[locale];
  const num = new Intl.NumberFormat(intl);
  const compact = new Intl.NumberFormat(intl, { notation: 'compact', maximumFractionDigits: 1 });
  const pct = (v: number) => new Intl.NumberFormat(intl, { style: 'percent' }).format(v / 100);
  const total = SEARCHES.reduce((a, v, i) => a + v + OPENS[i]!, 0);
  const sLine = smooth(SEARCHES);
  const oLine = smooth(OPENS);

  return (
    <section>
      <Container size="lg" py={{ base: 8, md: 16 }}>
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
          {/* Decorative: the points next to it say what the sample shows. */}
          <div
            aria-hidden
            className={cn(
              css.dark,
              'pointer-events-none order-2 select-none rounded-lg px-4 py-8 sm:px-8 sm:pb-32 sm:pt-14 lg:order-1',
            )}
          >
            <div className="relative mx-auto max-w-xl">
              {/* Main trend card */}
              <Card p={0} className="overflow-hidden shadow-pop sm:w-[76%]">
                <div className="flex flex-col gap-4 p-4 sm:p-6">
                  <Inline justify="between" align="start" gap={2}>
                    <div className="min-w-0">
                      <p className="text-small font-bold text-ink">{ti('perDay.title')}</p>
                      <p className="text-small text-ink-muted">{ti('lastDays', { count: 30 })}</p>
                    </div>
                    <Badge tone="primary">{tp('sample')}</Badge>
                  </Inline>

                  <div className="grid grid-cols-2 gap-2">
                    <Kpi label={ti('kpi.searches')} value={compact.format(total)} trend="+18%" />
                    <Kpi label={ti('kpi.bloggers')} value={num.format(ACTIVE)} trend="+9%" />
                  </div>

                  <Inline gap={4} wrap>
                    <Legend color="var(--bf-chart-1)" label={t('searches')} />
                    <Legend color="var(--bf-chart-2)" label={t('opens')} />
                  </Inline>

                  <div className="relative">
                    <div className="relative h-36">
                      <svg
                        viewBox={`0 0 ${W} ${H}`}
                        preserveAspectRatio="none"
                        className="absolute inset-0 size-full overflow-visible"
                      >
                        <defs>
                          <linearGradient id="bi-s" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0" stopColor="var(--bf-chart-1)" stopOpacity="0.32" />
                            <stop offset="1" stopColor="var(--bf-chart-1)" stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id="bi-o" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0" stopColor="var(--bf-chart-2)" stopOpacity="0.32" />
                            <stop offset="1" stopColor="var(--bf-chart-2)" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {[0.25, 0.5, 0.75].map((g) => (
                          <line
                            key={g}
                            x1={0}
                            x2={W}
                            y1={H * g}
                            y2={H * g}
                            stroke="var(--bf-line)"
                            strokeDasharray="3 4"
                            vectorEffect="non-scaling-stroke"
                          />
                        ))}
                        <path d={area(sLine)} fill="url(#bi-s)" className={css.fade} />
                        <path d={area(oLine)} fill="url(#bi-o)" className={css.fade} />
                        <path
                          d={sLine}
                          fill="none"
                          stroke="var(--bf-chart-1)"
                          strokeWidth={2}
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          pathLength={1}
                          className={css.draw}
                        />
                        <path
                          d={oLine}
                          fill="none"
                          stroke="var(--bf-chart-2)"
                          strokeWidth={2}
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          pathLength={1}
                          className={css.draw}
                          style={{ animationDelay: '150ms' }}
                        />
                        <line
                          x1={x(PEAK)}
                          x2={x(PEAK)}
                          y1={0}
                          y2={H}
                          stroke="var(--bf-ink-muted)"
                          strokeDasharray="2 3"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                      {/* Markers in HTML so they stay round on a stretched SVG. */}
                      {(
                        [
                          [SEARCHES[PEAK]!, 'var(--bf-chart-1)'],
                          [OPENS[PEAK]!, 'var(--bf-chart-2)'],
                        ] as const
                      ).map(([v, c]) => (
                        <span
                          key={c}
                          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-pill ring-2 ring-surface-raised"
                          style={{
                            left: `${(x(PEAK) / W) * 100}%`,
                            top: `${(y(v) / H) * 100}%`,
                            background: c,
                          }}
                        />
                      ))}
                      {/* Tooltip at the crosshair */}
                      <div
                        className={cn(
                          css.pop,
                          'absolute -top-3 flex -translate-x-[calc(100%+12px)] flex-col whitespace-nowrap gap-1 rounded-sm bg-ink px-3 py-2 text-[11px] text-surface shadow-pop',
                        )}
                        style={{ left: `${(x(PEAK) / W) * 100}%`, animationDelay: '1s' }}
                      >
                        <span className="flex items-center gap-2">
                          <span className="size-2 rounded-pill bg-chart-1" />
                          {t('searches')}
                          <b className="ml-auto pl-2 tabular-nums">{num.format(SEARCHES[PEAK]!)}</b>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="size-2 rounded-pill bg-chart-2" />
                          {t('opens')}
                          <b className="ml-auto pl-2 tabular-nums">{num.format(OPENS[PEAK]!)}</b>
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] tabular-nums text-ink-muted">
                      <span>1</span>
                      <span>10</span>
                      <span>20</span>
                      <span>30</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Layered cards: in the flow on phones, over the trend card's corners from sm up. */}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-0 sm:block">
                <Card
                  p={4}
                  className={cn(
                    css.float,
                    'shadow-pop sm:absolute sm:right-0 sm:top-[28%] sm:w-48',
                  )}
                >
                  <p className="mb-2 text-small font-bold text-ink">{ti('platforms.title')}</p>
                  <div className="flex items-center gap-4 sm:flex-col sm:items-stretch">
                    <Donut center={pct(PLATFORMS[0][1])} />
                    <ul className="flex min-w-0 flex-1 flex-col gap-1">
                      {PLATFORMS.map(([k, v], i) => (
                        <li key={k} className="flex items-center gap-2 text-small text-ink">
                          <span
                            className="size-2.5 shrink-0 rounded-[3px]"
                            style={{ background: `var(--bf-chart-${i + 1})` }}
                          />
                          <span className="min-w-0 flex-1 truncate">{tf(`platform.${k}`)}</span>
                          <b className="tabular-nums">{pct(v)}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>

                <Card
                  p={4}
                  className={cn(
                    css.floatSlow,
                    'shadow-pop sm:absolute sm:-bottom-24 sm:-left-4 sm:w-56',
                  )}
                >
                  <p className="mb-2 text-small font-bold text-ink">{ti('niches.title')}</p>
                  <ul className="flex flex-col gap-2">
                    {NICHES.map(([k, v], i) => (
                      <li key={k} className="flex flex-col gap-1">
                        <span className="flex justify-between gap-2 text-small text-ink">
                          <span className="truncate">{o.niche(k)}</span>
                          <b className="tabular-nums">{pct(v)}</b>
                        </span>
                        <span className="h-1.5 rounded-pill bg-surface">
                          <span
                            className={cn(css.grow, 'block h-full rounded-pill bg-chart-1')}
                            style={{
                              width: `${(v / NICHES[0][1]) * 100}%`,
                              animationDelay: `${300 + i * 120}ms`,
                            }}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card
                  p={4}
                  className={cn(
                    css.float,
                    'shadow-pop sm:absolute sm:-bottom-20 sm:right-2 sm:w-52',
                  )}
                >
                  <p className="mb-2 text-small font-bold text-ink">{ti('payment.title')}</p>
                  <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-pill">
                    <span className="bg-primary" style={{ width: `${100 - BARTER}%` }} />
                    <span className="flex-1 bg-sun" />
                  </div>
                  <div className="mt-2 flex justify-between gap-2 text-small text-ink">
                    <span>
                      {tf('paymentType.MONEY')} <b className="tabular-nums">{pct(100 - BARTER)}</b>
                    </span>
                    <span>
                      {tf('paymentType.BARTER')} <b className="tabular-nums">{pct(BARTER)}</b>
                    </span>
                  </div>
                </Card>

                <span
                  className={cn(
                    css.floatSlow,
                    'inline-flex items-center gap-2 self-start justify-self-start rounded-pill bg-surface-raised px-4 py-2 text-small font-bold text-ink shadow-pop sm:absolute sm:-top-6 sm:right-4',
                  )}
                >
                  <Icon name="sparkles" size="xs" tone="accent" />
                  {t('mostWanted', { format: tf('contentFormat.REEL') })}
                </span>
              </div>
            </div>
          </div>

          <Stack gap={6} align="start" className="order-1 lg:order-2">
            <Stack gap={2}>
              <p className="text-label uppercase text-primary-text">{t('eyebrow')}</p>
              <Heading level={2}>{t('title')}</Heading>
              <Text tone="muted">{t('lead')}</Text>
            </Stack>
            <Stack gap={4}>
              {(
                [
                  ['wants', 'search'],
                  ['money', 'wallet'],
                  ['cities', 'pin'],
                ] as const
              ).map(([k, icon]) => (
                <Inline key={k} gap={4} align="start">
                  <IconBubble name={icon} tone="primary" />
                  <Text className="pt-2">{t(`points.${k}`)}</Text>
                </Inline>
              ))}
            </Stack>
            <Inline gap={2} align="start">
              <Icon name="lock" size="xs" tone="muted" className="mt-1" />
              <Text size="small" tone="muted">
                {t('privacy')}
              </Text>
            </Inline>
            <Link href={cta} className={buttonStyles({ size: 'lg' })}>
              {tb('cta')}
            </Link>
          </Stack>
        </div>
      </Container>
    </section>
  );
}

function Kpi({ label, value, trend }: { label: string; value: string; trend: string }) {
  return (
    <div className="rounded-sm bg-surface p-2">
      <p className="truncate text-small text-ink-muted">{label}</p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="whitespace-nowrap text-h2 font-extrabold tabular-nums text-ink">
          {value}
        </span>
        <span className="inline-flex items-center text-small font-bold text-success">
          <Icon name="trend" size="xs" />
          {trend}
        </span>
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-small text-ink">
      <span className="h-0.5 w-4 rounded-pill" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Platform shares as a donut with 2px gaps between slices. */
function Donut({ center }: { center: string }) {
  const size = 96;
  const r = 38;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative size-24 shrink-0 sm:mx-auto">
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {PLATFORMS.map(([k, v], i) => {
          const len = (v / 100) * c;
          const seg = (
            <circle
              key={k}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={`var(--bf-chart-${i + 1})`}
              strokeWidth={14}
              strokeDasharray={`${len - 2} ${c}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return seg;
        })}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-body font-extrabold tabular-nums text-ink">
        {center}
      </span>
    </div>
  );
}
