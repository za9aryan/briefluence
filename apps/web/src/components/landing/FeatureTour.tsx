'use client';
import {
  Avatar,
  Badge,
  Container,
  Eyebrow,
  Heading,
  Icon,
  LogoMark,
  PlatformLogo,
  ScoreMeter,
  Text,
  cn,
  type IconName,
} from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import css from './FeatureTour.module.css';

export type TourItem = { key: string; icon: IconName; title: string; body: string; art: ReactNode };

/**
 * A numbered list on one side (the active item opens, with a progress bar that moves the tour on
 * every few seconds) and an illustration of the active item on the other. Pauses on hover/focus
 * and off screen; with reduced motion it never moves on by itself. Used for the /for-influencers
 * features and the home page's "How it works".
 */
export function Tour({
  id,
  eyebrow,
  title,
  lead,
  items,
  raised = true,
}: {
  /** Unique per page (tab ids). */
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
  items: TourItem[];
  raised?: boolean;
}) {
  const [active, setActive] = useState(0);
  const [hold, setHold] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), {
      threshold: 0.35,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const current = items[active]!;
  const running = visible && !hold;

  return (
    <section className={raised ? 'bg-surface-raised' : undefined}>
      <Container py={{ base: 8, md: 12, lg: 16 }}>
        <div className="mb-8 max-w-2xl md:mb-12">
          <Eyebrow>{eyebrow}</Eyebrow>
          <Heading level={2} className="mt-2">
            {title}
          </Heading>
          {lead && (
            <Text tone="muted" className="mt-2">
              {lead}
            </Text>
          )}
        </div>
        <div
          ref={ref}
          className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12"
          onPointerEnter={() => setHold(true)}
          onPointerLeave={() => setHold(false)}
          onFocus={() => setHold(true)}
          onBlur={() => setHold(false)}
        >
          <div
            role="tablist"
            aria-orientation="vertical"
            className="order-2 flex flex-col gap-2 lg:order-1"
          >
            {items.map((it, i) => {
              const on = i === active;
              return (
                <button
                  key={it.key}
                  type="button"
                  role="tab"
                  id={`${id}-tab-${it.key}`}
                  aria-selected={on}
                  aria-controls={`${id}-panel`}
                  onClick={() => setActive(i)}
                  className={cn(css.item, on && css.on, 'rounded-card p-4 text-left')}
                >
                  <span className="flex items-center gap-4">
                    <span className={css.badge}>
                      <Icon name={it.icon} size="md" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={css.num}>{String(i + 1).padStart(2, '0')}</span>
                      <span className="block text-h2 font-bold text-ink">{it.title}</span>
                    </span>
                  </span>
                  <span className={css.body}>
                    <span className="block overflow-hidden">
                      <span className="block pt-2 text-ink-muted">{it.body}</span>
                    </span>
                  </span>
                  {on && (
                    <span className={css.track}>
                      <span
                        key={active}
                        className={css.progress}
                        style={{ animationPlayState: running ? 'running' : 'paused' }}
                        onAnimationEnd={() => setActive((a) => (a + 1) % items.length)}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div
            id={`${id}-panel`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${current.key}`}
            className={cn(css.stage, 'order-1 rounded-lg lg:order-2')}
          >
            <div
              key={current.key}
              aria-hidden
              className={cn(css.scene, 'pointer-events-none select-none')}
            >
              {current.art}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

type Key = 'feed' | 'verified' | 'track' | 'direct';
const ART: Record<Key, () => ReactNode> = {
  feed: FeedArt,
  verified: VerifiedArt,
  track: TrackArt,
  direct: DirectArt,
};

/** /for-influencers: the four features. Texts: `landing.influencers.features.<key>`. */
export function FeatureTour({ items }: { items: [Key, IconName][] }) {
  const t = useTranslations('landing.influencers.features');
  const tp = useTranslations('promo.features');
  return (
    <Tour
      id="features"
      eyebrow={tp('eyebrow')}
      title={tp('title')}
      items={items.map(([k, icon]) => {
        const Art = ART[k];
        return { key: k, icon, title: t(`${k}.title`), body: t(`${k}.body`), art: <Art /> };
      })}
    />
  );
}

/* ---------- Illustrations (made-up sample data) ---------- */

function FeedArt() {
  const ts = useTranslations('showcase.briefs');
  const tm = useTranslations('promo.toolkit.match');
  const tp = useTranslations('promo.features');
  const td = useTranslations('deals');
  const rows = [
    ['coffee', 96],
    ['hotel', 88],
    ['gym', 74],
  ] as const;
  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <span className={cn(css.chip, 'self-start')}>
        <Icon name="sparkles" size="xs" />
        {tp('sorted')}
      </span>
      {rows.map(([k, score], i) => (
        <div
          key={k}
          className={cn(css.card, css.rise, 'flex items-center gap-4 p-2 pr-4', i > 0 && css.dim)}
          style={{ animationDelay: `${i * 120}ms` }}
        >
          <span
            className="size-14 shrink-0 rounded-[12px] bg-cover bg-center"
            style={{ backgroundImage: `url(/showcase/${k}.webp)` }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-bold text-ink">{ts(`${k}.title`)}</p>
            <p className="truncate text-[12px] text-ink-muted">{ts(`${k}.brand`)}</p>
            {i === 0 && (
              <span className="mt-1 flex flex-wrap gap-1">
                {(['city', 'age', 'followers'] as const).map((r) => (
                  <Badge key={r} variant="small" tone="success" icon="check">
                    {tm(r)}
                  </Badge>
                ))}
              </span>
            )}
          </div>
          <ScoreMeter value={score} label={td('match')} size={i === 0 ? 'md' : 'sm'} />
        </div>
      ))}
    </div>
  );
}

function VerifiedArt() {
  const tv = useTranslations('enums.verificationStatus');
  const ta = useTranslations('promo.analytics.card');
  const tp = useTranslations('promo.features');
  const stats = [
    [ta('followers'), '24.3K'],
    [ta('avgViews'), '9.8K'],
    [ta('er'), '4.6%'],
  ] as const;
  return (
    <div className="relative w-full max-w-sm">
      <div className={cn(css.card, css.rise, 'p-4')}>
        <div className="flex items-center gap-2">
          <Avatar name={ta('name')} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-ink">{ta('name')}</p>
            <p className="truncate text-small text-ink-muted">@anna.eats</p>
          </div>
          <span className={css.seal}>
            <Icon name="verified" size="md" />
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {stats.map(([label, value], i) => (
            <div
              key={label}
              className={cn(css.rise, 'rounded-sm bg-surface p-2')}
              style={{ animationDelay: `${200 + i * 120}ms` }}
            >
              <p className="truncate text-[11px] text-ink-muted">{label}</p>
              <p className="flex items-center gap-1 font-extrabold tabular-nums text-ink">
                {value}
                <Icon name="check" size="xs" tone="success" />
              </p>
            </div>
          ))}
        </div>
      </div>
      <span className={cn(css.chip, css.float, 'absolute -top-4 right-4')}>
        <Icon name="verified" size="xs" />
        {tv('APPROVED')}
      </span>
      <span className={cn(css.source, css.floatSlow, 'absolute -bottom-5 left-4')}>
        <PlatformLogo platform="INSTAGRAM" size="sm" className="size-6 rounded-[8px]" />
        {tp('source')}
      </span>
    </div>
  );
}

function TrackArt() {
  const ts = useTranslations('enums.applicationStatus');
  const steps = ['APPLIED', 'VIEWED', 'SHORTLISTED', 'ACCEPTED'] as const;
  return (
    <div className={cn(css.card, 'w-full max-w-md p-4 sm:p-6')}>
      <ol className="relative flex flex-col gap-4">
        <span aria-hidden className={css.rail}>
          <span className={css.fill} />
        </span>
        {steps.map((s, i) => (
          <li
            key={s}
            className={cn(css.step, 'relative flex items-center gap-4')}
            style={{ animationDelay: `${300 + i * 550}ms` }}
          >
            <span className={cn(css.dot, i === steps.length - 1 && css.dotWin)}>
              <Icon name={i === steps.length - 1 ? 'check-circle' : 'check'} size="xs" />
            </span>
            <span
              className={cn(
                'text-body font-bold',
                i === steps.length - 1 ? 'text-success' : 'text-ink',
              )}
            >
              {ts(s)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DirectArt() {
  const tp = useTranslations('promo.features');
  const tb = useTranslations('promo');
  const tm = useTranslations('enums.contactMethod');
  return (
    <div className="relative w-full max-w-sm">
      <div className={cn(css.card, 'p-4')}>
        <div className="flex items-center gap-2">
          <span className="inline-flex size-11 items-center justify-center rounded-sm bg-primary text-on-primary">
            <LogoMark className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-ink">{tb('briefs.coffee.brand')}</p>
            <p className="truncate text-small text-ink-muted">{tp('person')}</p>
          </div>
          <span className={css.lock}>
            <Icon name="lock" size="sm" className={css.lockClosed} />
            <Icon name="check" size="sm" className={css.lockOpen} />
          </span>
        </div>
        <div className={cn(css.contact, 'mt-4')}>
          <Icon name="telegram" size="sm" />
          <span className="min-w-0 flex-1 truncate font-bold">{tm('TELEGRAM')}: @nordic_roast</span>
          <span className={css.write}>{tp('write')}</span>
        </div>
      </div>
      <span className={cn(css.chip, css.unlocked, 'absolute -top-4 left-4')}>
        <Icon name="check-circle" size="xs" />
        {tp('unlocked')}
      </span>
    </div>
  );
}
