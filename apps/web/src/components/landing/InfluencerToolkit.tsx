'use client';
import {
  Badge,
  Card,
  Container,
  Heading,
  Icon,
  IconBubble,
  Inline,
  LogoMark,
  ScoreMeter,
  Stack,
  Text,
  buttonStyles,
  cn,
} from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ExamplePrice } from './ExamplePrice';
import css from './Promo.module.css';

/**
 * /for-influencers: the tools an influencer gets, as a bento grid of small illustrated tiles
 * (phone with push notifications, email digest, match score, application tracker, offers and the
 * public page). Sample data only; the illustrations are decorative, the tile texts carry the meaning.
 */
export function InfluencerToolkit({ cta }: { cta: string }) {
  const t = useTranslations('promo.toolkit');
  return (
    <section>
      <Container size="lg" py={{ base: 8, md: 16 }}>
        <div className={cn(css.dark, 'rounded-lg px-4 py-8 sm:p-8 lg:p-12')}>
          <div className="mb-8 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between">
            <Stack gap={2} className="max-w-2xl">
              <p className={cn(css.eyebrow, 'text-label uppercase')}>{t('eyebrow')}</p>
              <Heading level={2} className="text-surface">
                {t('title')}
              </Heading>
              <Text className={css.muted}>{t('lead')}</Text>
            </Stack>
            <Link
              href={cta}
              className={buttonStyles({
                className:
                  'w-full shrink-0 whitespace-normal bg-surface text-center text-ink hover:bg-surface-raised sm:w-auto',
              })}
            >
              {t('cta')} <Icon name="arrow-right" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Tile
              className="md:row-span-2"
              title={t('push.title')}
              body={t('push.body')}
              art={<PhoneArt />}
            />
            <Tile
              className="lg:col-span-2"
              title={t('email.title')}
              body={t('email.body')}
              art={<EmailArt />}
            />
            <Tile title={t('match.title')} body={t('match.body')} art={<MatchArt />} />
            <Tile title={t('track.title')} body={t('track.body')} art={<TrackArt />} />
            <Tile title={t('offers.title')} body={t('offers.body')} art={<OfferArt />} />
            <Tile
              className="md:col-span-2"
              title={t('page.title')}
              body={t('page.body')}
              art={<PageArt />}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

function Tile({
  title,
  body,
  art,
  className,
}: {
  title: string;
  body: string;
  art: ReactNode;
  className?: string;
}) {
  return (
    <Card p={0} className={cn(css.tile, 'flex flex-col', className)}>
      <div className="p-6 pb-0">
        <Heading level={3}>{title}</Heading>
        <Text size="small" tone="muted" className="mt-1">
          {body}
        </Text>
      </div>
      <div
        aria-hidden
        className="pointer-events-none flex flex-1 select-none items-center justify-center p-6"
      >
        {art}
      </div>
    </Card>
  );
}

function AppIcon({ size = 'size-8' }: { size?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[10px] bg-primary text-on-primary',
        size,
      )}
    >
      <LogoMark className="size-1/2" />
    </span>
  );
}

function PhoneArt() {
  const t = useTranslations('promo.toolkit.push');
  const items = [
    { title: t('n1title'), body: t('n1body'), when: t('now') },
    { title: t('n2title'), body: t('n2body'), when: t('min') },
    { title: t('n3title'), body: t('n3body'), when: t('hour') },
  ];
  return (
    <div className={css.phone}>
      <span className={css.notch} />
      <div className={css.screen} style={{ backgroundImage: 'url(/showcase/wallpaper.webp)' }}>
        <div className="relative z-[1] flex h-full flex-col px-3 pt-12">
          <p className="text-center text-small font-bold text-on-scrim">{t('date')}</p>
          <p className="text-center text-[3.25rem] font-extrabold leading-none text-on-scrim">
            {t('time')}
          </p>
          <div className="mt-auto flex flex-col gap-2 pb-6">
            {items.map((n, i) => (
              <div
                key={n.title}
                className={cn(css.notification, css.pop, 'flex gap-2 rounded-[18px] p-2.5')}
                style={{ animationDelay: `${300 + i * 350}ms` }}
              >
                <AppIcon />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-bold leading-tight text-ink">{n.title}</p>
                    <span className="shrink-0 text-[10px] text-ink-muted">{n.when}</span>
                  </div>
                  <p className="line-clamp-2 text-[12px] leading-snug text-ink">{n.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailArt() {
  const t = useTranslations('promo.toolkit.email');
  const rows = [
    {
      title: t('r1'),
      price: <ExamplePrice amount={300} to={500} currency="USD" />,
      icon: 'instagram' as const,
    },
    { title: t('r2'), price: null, icon: 'instagram' as const },
    {
      title: t('r3'),
      price: <ExamplePrice amount={150} currency="USD" />,
      icon: 'instagram' as const,
    },
  ];
  return (
    <div className="w-full max-w-xl overflow-hidden rounded-card border border-line bg-surface shadow-pop">
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-2">
        <span className="size-2.5 rounded-pill bg-primary/60" />
        <span className="size-2.5 rounded-pill bg-sun" />
        <span className="size-2.5 rounded-pill bg-line" />
      </div>
      <div className="flex items-center gap-2 px-4 pt-4">
        <AppIcon />
        <div className="min-w-0 flex-1">
          <p className="text-small font-bold text-ink">{t('from')}</p>
          <p className="truncate text-small text-ink">{t('subject')}</p>
        </div>
        <span className="text-[11px] text-ink-muted">08:00</span>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {rows.map((r) => (
          <div
            key={r.title}
            className="flex items-center gap-2 rounded-sm bg-surface-raised p-2 ring-1 ring-line"
          >
            <IconBubble name={r.icon} size="sm" tone="primary" />
            {/* Phones: price under the title; wider: side by side. */}
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <span className="w-full min-w-0 truncate text-small font-bold text-ink sm:w-auto">
                {r.title}
              </span>
              {r.price ? (
                <span className="shrink-0 text-small font-bold tabular-nums text-ink">
                  {r.price}
                </span>
              ) : (
                <Badge tone="barter" variant="small">
                  {t('barter')}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchArt() {
  const t = useTranslations('promo.toolkit.match');
  return (
    <div className="flex w-full flex-col items-center gap-4 rounded-card bg-primary-soft p-4">
      <div className={css.float}>
        <ScoreMeter value={92} label={t('label')} size="lg" />
      </div>
      <Inline gap={1} wrap justify="center">
        {(['city', 'age', 'followers'] as const).map((k) => (
          <Badge key={k} variant="small" tone="success" icon="check">
            {t(k)}
          </Badge>
        ))}
      </Inline>
    </div>
  );
}

function TrackArt() {
  const ts = useTranslations('enums.applicationStatus');
  const steps = ['APPLIED', 'VIEWED', 'SHORTLISTED', 'ACCEPTED'] as const;
  return (
    <ol className="flex w-full flex-col gap-0 rounded-card bg-surface p-4">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s} className="flex gap-2">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'inline-flex size-6 items-center justify-center rounded-pill',
                  last ? 'bg-success text-on-primary' : 'bg-primary-soft text-primary-text',
                )}
              >
                <Icon name="check" size="xs" />
              </span>
              {!last && <span className="h-4 w-0.5 bg-primary/30" />}
            </div>
            <span className={cn('pt-0.5 text-small', last ? 'font-bold text-success' : 'text-ink')}>
              {ts(s)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function OfferArt() {
  const t = useTranslations('promo.toolkit.offers');
  return (
    <div className="relative w-full">
      <div className="overflow-hidden rounded-card border border-line bg-surface-raised shadow-pop">
        <div
          className="aspect-[16/9] bg-cover bg-center"
          style={{ backgroundImage: 'url(/showcase/anna.webp)' }}
        />
        <div className="flex items-center justify-between gap-2 p-3">
          <span className="min-w-0 truncate text-small font-bold text-ink">{t('item')}</span>
          <span className="shrink-0 font-extrabold tabular-nums text-ink">
            <ExamplePrice amount={80} currency="USD" />
          </span>
        </div>
      </div>
      <span
        className={cn(
          css.float,
          'absolute -top-3 right-3 inline-flex items-center gap-1.5 rounded-pill bg-primary px-3 py-1 text-small font-bold text-on-primary shadow-pop',
        )}
      >
        <span className="size-2 rounded-pill bg-on-primary motion-safe:animate-pulse" />
        {t('requests', { count: 2 })}
      </span>
    </div>
  );
}

function PageArt() {
  const t = useTranslations('promo.toolkit.page');
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center gap-2 rounded-pill border border-line bg-surface py-1.5 pl-4 pr-1.5">
        <Icon name="link" size="xs" tone="muted" />
        <span className="min-w-0 flex-1 truncate text-small text-ink">
          briefluence.com/<b>@{t('handle')}</b>
        </span>
        <span className="rounded-pill bg-primary px-3 py-1 text-small font-bold text-on-primary">
          {t('copy')}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['giulia', 'coffee', 'bakery'].map((k, i) => (
          <div
            key={k}
            className={cn(
              'aspect-[4/5] rounded-card bg-cover bg-center shadow-pop',
              i === 1 && 'sm:-translate-y-3',
            )}
            style={{ backgroundImage: `url(/showcase/${k}.webp)` }}
          />
        ))}
      </div>
    </div>
  );
}
