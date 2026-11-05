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
                  <Text size="small" weight="bold" tone="muted">
                    <Icon name="lock" size="xs" className="mr-1 inline" />
                    {tp('priceLocked')}
                  </Text>
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

/** Where stats would be, for guests: a lock, why, and the way in. */
export function LockedPanel({ children, onUnlock }: { children: ReactNode; onUnlock: () => void }) {
  const tp = useTranslations('portfolio.public');
  return (
    <Stack gap={2} align="start" className="rounded-card border border-dashed border-line p-4">
      <Text size="small" tone="muted">
        <Icon name="lock" size="xs" className="mr-1 inline" />
        {children}
      </Text>
      <Button size="sm" variant="secondary" onClick={onUnlock}>
        {tp('signInToSee')}
      </Button>
    </Stack>
  );
}
