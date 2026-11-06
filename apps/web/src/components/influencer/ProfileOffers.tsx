'use client';
import {
  Button,
  Card,
  Carousel,
  Icon,
  MediaCover,
  Modal,
  Stack,
  Text,
  buttonStyles,
} from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CollaborationBadge } from '@/components/domain/badges';
import { OfferMeta, OfferPrice } from '@/components/offers/OfferParts';
import type { ProfileOfferDto } from '@/lib/types';

/**
 * A blogger's active offers as a row of cards (like the portfolio). A card opens the offer page
 * (`href`); for guests it opens the sign-in sheet instead (`onLocked`), and prices stay hidden.
 */
export function ProfileOffers({
  offers,
  fallbackImage,
  name,
  href,
  onLocked,
}: {
  offers: ProfileOfferDto[];
  /** Shown when an offer has no cover (the blogger's photo). */
  fallbackImage: string | null;
  /** The blogger's name: initials fill the cover when there is no image at all. */
  name: string;
  href?: (id: string) => string;
  onLocked?: () => void;
}) {
  const t = useTranslations('portfolio.view');
  const tp = useTranslations('portfolio.public');
  return (
    <Carousel
      label={tp('offers')}
      prevLabel={t('previous')}
      nextLabel={t('next')}
      itemClassName="w-60 sm:w-64"
    >
      {offers.map((o) => {
        const body = (
          <Card
            interactive={!!(href || onLocked)}
            p={0}
            className="flex h-full flex-col overflow-hidden"
          >
            <MediaCover
              aspect="photo"
              src={o.imageUrl ?? fallbackImage}
              alt=""
              fallback={
                <span className="text-display font-extrabold text-primary-text" aria-hidden>
                  {name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase())
                    .join('')}
                </span>
              }
              topRight={<CollaborationBadge type={o.collaborationType} />}
            />
            <Stack gap={2} className="flex-1 p-4">
              <Text weight="bold" className="line-clamp-2">
                {o.title}
              </Text>
              <OfferMeta offer={o} />
              <div className="mt-auto border-t border-line pt-3">
                {o.hasPrice && o.priceMinor == null ? (
                  // Guests: a blurred placeholder (never the real price, they don't get it) under a lock pill.
                  <span className="flex flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="select-none text-h2 font-extrabold tabular-nums text-ink blur-[5px]"
                      >
                        88 000
                      </span>
                      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-pill bg-ink text-surface shadow-pop">
                        <Icon name="lock" size="xs" />
                      </span>
                    </span>
                    <Text as="span" size="small" weight="bold" tone="muted">
                      {tp('priceLocked')}
                    </Text>
                  </span>
                ) : (
                  <OfferPrice
                    offer={{ priceMinor: o.priceMinor, currency: o.currency ?? 'AMD' }}
                    size="body"
                  />
                )}
              </div>
            </Stack>
          </Card>
        );
        return href ? (
          <Link
            key={o.id}
            href={href(o.id)}
            className="block h-full rounded-card"
            aria-label={o.title}
          >
            {body}
          </Link>
        ) : onLocked ? (
          <button
            key={o.id}
            type="button"
            onClick={onLocked}
            className="block h-full w-full rounded-card text-left"
            aria-label={o.title}
          >
            {body}
          </button>
        ) : (
          <div key={o.id} className="h-full">
            {body}
          </div>
        );
      })}
    </Carousel>
  );
}

/** "Sign in to see more" sheet for guests on a public profile; returns them to `next` after login. */
export function GuestGate({
  open,
  onClose,
  next,
}: {
  open: boolean;
  onClose: () => void;
  next: string;
}) {
  const tp = useTranslations('portfolio.public');
  const tc = useTranslations('common');
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      closeLabel={tc('close')}
      title={tp('gateTitle')}
      description={tp('gateText')}
      footer={
        <>
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className={buttonStyles({ variant: 'neutral', block: true, className: 'sm:w-auto' })}
          >
            {tp('logIn')}
          </Link>
          <Link
            href="/signup?role=BRAND"
            className={buttonStyles({ block: true, className: 'sm:w-auto' })}
          >
            {tp('joinAsBrand')}
          </Link>
        </>
      }
    />
  );
}

/* Placeholder numbers for the blurred preview. Never the blogger's real stats: guests don't get them. */
const FAKE = {
  kpis: ['24.3K', '4.6%', '9.8K', '412'],
  ages: [62, 100, 38, 20],
  countries: [80, 34, 18, 10],
};

/**
 * What a guest sees instead of an account's stats: the stats layout, blurred and filled with
 * placeholders, with a lock card on top that asks them to sign in.
 */
export function LockedStats({ children, onUnlock }: { children: ReactNode; onUnlock: () => void }) {
  const tp = useTranslations('portfolio.public');
  const th = useTranslations('portfolio.view.hero');
  const tv = useTranslations('verification');
  return (
    <div className="relative overflow-hidden rounded-card">
      <div aria-hidden className="pointer-events-none select-none p-2 blur-[5px]">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {[th('followers'), th('engagement'), tv('avgViews'), tv('posts')].map((label, i) => (
            <span key={label} className="flex flex-col">
              <span className="truncate text-label uppercase text-ink-muted">{label}</span>
              <span className="text-h2 font-extrabold text-ink">{FAKE.kpis[i]}</span>
            </span>
          ))}
        </div>
        <div className="mt-6 flex justify-between text-small font-bold text-ink">
          <span>60%</span>
          <span>40%</span>
        </div>
        <div className="mt-1 flex h-3 gap-0.5 overflow-hidden rounded-pill">
          <span className="w-3/5 bg-primary" />
          <span className="flex-1 bg-ink-muted" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            {FAKE.ages.map((v) => (
              <span key={v} className="flex items-center gap-2">
                <span className="h-3 w-10 rounded-sm bg-line" />
                <span className="h-2 flex-1 rounded-pill bg-surface">
                  <span
                    className="block h-full rounded-pill bg-primary"
                    style={{ width: `${v}%` }}
                  />
                </span>
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {FAKE.countries.map((v) => (
              <span key={v} className="flex items-center gap-2">
                <span className="h-3 w-4 rounded-[2px] bg-chart-2" />
                <span className="h-2 flex-1 rounded-pill bg-surface">
                  <span
                    className="block h-full rounded-pill bg-primary"
                    style={{ width: `${v}%` }}
                  />
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Lock card over the blurred preview */}
      <div className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 justify-center">
        <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-card border border-line bg-surface-raised/90 p-3 text-center shadow-pop backdrop-blur-sm sm:flex-row sm:text-left">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill bg-ink text-surface">
            <Icon name="lock" size="sm" />
          </span>
          <Text size="small" className="flex-1">
            {children}
          </Text>
          <Button size="sm" onClick={onUnlock} className="shrink-0">
            {tp('signInToSee')}
          </Button>
        </div>
      </div>
    </div>
  );
}
