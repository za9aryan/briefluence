'use client';
import {
  Alert,
  Avatar,
  Card,
  CardHeader,
  Grid,
  Heading,
  Icon,
  Inline,
  Stack,
  Text,
} from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { ContactMethod } from '@briefluence/shared';
import { AccountLine, AccountStats } from '@/components/domain/AccountStats';
import { ContactLink } from '@/components/domain/ContactLink';
import { VerifiedBadge } from '@/components/domain/badges';
import { FaqAnswers, PortfolioGallery } from '@/components/portfolio/PortfolioParts';
import { PLATFORM_ICON, useOptions } from '@/lib/hooks/options';
import type {
  FaqAnswerDto,
  GuestAccountDto,
  PortfolioItemDto,
  ProfileAccess,
  ProfileOfferDto,
  SocialAccountDto,
} from '@/lib/types';
import { GuestGate, LockedPanel, ProfileOffers } from './ProfileOffers';

interface ProfileBase {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  country: string;
  city: string | null;
  languages: string[];
  niches: string[];
  verified: boolean;
  /** Only answered questions and approved work: empty means the section is hidden. */
  faq: FaqAnswerDto[];
  portfolio: PortfolioItemDto[];
  /** Active offers; guests get them without prices. */
  offers: ProfileOfferDto[];
}

/** Brands, admins and the owner see everything; guests (and other bloggers) a lighter version. */
export type PublicInfluencer =
  | (ProfileBase & {
      access: Exclude<ProfileAccess, 'guest'>;
      socialAccounts: SocialAccountDto[];
      contacts: { method: ContactMethod | null; value: string | null } | null;
    })
  | (ProfileBase & { access: 'guest'; socialAccounts: GuestAccountDto[]; contacts: null });

const OFFER_HREF: Partial<Record<ProfileAccess, (id: string) => string>> = {
  brand: (id) => `/brand/offers/${id}`,
  owner: (id) => `/influencer/offers/${id}`,
};

/**
 * A blogger's profile as brands see it. Used on the brand's blogger page, in the blogger's own
 * "See how it looks" preview and on the public page (briefluence.com/@username), so they never
 * drift apart. Guests see who the blogger is and their work; stats, prices and contacts are
 * replaced by sign-in prompts.
 */
export function InfluencerPublicProfile({ p }: { p: PublicInfluencer }) {
  const t = useTranslations('applications.brand');
  const tp = useTranslations('portfolio.view');
  const tpub = useTranslations('portfolio.public');
  const o = useOptions();
  const [gate, setGate] = useState(false);
  const guest = p.access === 'guest';
  return (
    <Stack gap={6}>
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar size="xl" name={p.displayName} src={p.avatarUrl} />
          <Stack gap={1}>
            <Inline gap={2} wrap>
              <h1 className="text-h1 font-extrabold text-ink">{p.displayName}</h1>
              {p.verified && <VerifiedBadge />}
            </Inline>
            <Text tone="muted">{[p.city, o.country(p.country)].filter(Boolean).join(', ')}</Text>
            <Text size="small" tone="muted">
              {[p.niches.map(o.niche).join(', '), p.languages.map(o.language).join(', ')]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </Stack>
        </div>
        {p.bio && <Text className="mt-4">{p.bio}</Text>}
      </Card>
      {p.access === 'guest' ? (
        <Grid cols={{ base: 1, md: 2 }} gap={6}>
          {p.socialAccounts.map((a) => (
            <Card key={a.id}>
              <Stack gap={4}>
                <a
                  href={a.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 max-w-full items-center gap-1 self-start font-bold text-ink hover:underline"
                >
                  <Icon name={PLATFORM_ICON[a.platform]} />
                  <span className="min-w-0 wrap-anywhere">@{a.username}</span>
                  <Icon name="external" size="xs" tone="muted" />
                </a>
                <LockedPanel onUnlock={() => setGate(true)}>{tpub('statsLocked')}</LockedPanel>
              </Stack>
            </Card>
          ))}
        </Grid>
      ) : (
        <>
          {p.contacts ? (
            <Alert tone="success" title={t('contacts')}>
              <ContactLink method={p.contacts.method} value={p.contacts.value} />
            </Alert>
          ) : (
            <Alert tone="info">{t('contactsHidden')}</Alert>
          )}
          <Grid cols={{ base: 1, md: 2 }} gap={6}>
            {p.socialAccounts.map((a) => (
              <Card key={a.id}>
                <CardHeader title={<AccountLine account={a} />} />
                <AccountStats account={a} />
              </Card>
            ))}
          </Grid>
        </>
      )}
      {p.offers.length > 0 && (
        <Card>
          <CardHeader title={tpub('offers')} />
          <ProfileOffers
            offers={p.offers}
            fallbackImage={p.avatarUrl}
            name={p.displayName}
            href={OFFER_HREF[p.access]}
            onLocked={guest ? () => setGate(true) : undefined}
          />
        </Card>
      )}
      {p.faq.length > 0 && (
        <section aria-labelledby="blogger-faq" className="border-t border-line pt-8">
          <Heading level={2} id="blogger-faq" className="mb-2">
            {tp('faq')}
          </Heading>
          <FaqAnswers faq={p.faq} />
        </section>
      )}
      {p.portfolio.length > 0 && (
        <Card>
          <CardHeader title={tp('portfolio')} />
          <PortfolioGallery items={p.portfolio} />
        </Card>
      )}
      {guest && (
        <GuestGate
          open={gate}
          onClose={() => setGate(false)}
          next={p.username ? `/@${p.username}` : '/'}
        />
      )}
    </Stack>
  );
}
