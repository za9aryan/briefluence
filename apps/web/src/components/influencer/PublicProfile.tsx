'use client';
import {
  Alert,
  Avatar,
  Card,
  CardHeader,
  Grid,
  Heading,
  Inline,
  Stack,
  Text,
} from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import type { ContactMethod } from '@briefluence/shared';
import { AccountLine, AccountStats } from '@/components/domain/AccountStats';
import { ContactLink } from '@/components/domain/ContactLink';
import { VerifiedBadge } from '@/components/domain/badges';
import { FaqAnswers, PortfolioGallery } from '@/components/portfolio/PortfolioParts';
import { useOptions } from '@/lib/hooks/options';
import type { FaqAnswerDto, PortfolioItemDto, SocialAccountDto } from '@/lib/types';

export interface PublicInfluencer {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  country: string;
  city: string | null;
  languages: string[];
  niches: string[];
  verified: boolean;
  socialAccounts: SocialAccountDto[];
  contacts: { method: ContactMethod | null; value: string | null } | null;
  /** Only answered questions and approved work: empty means the section is hidden. */
  faq: FaqAnswerDto[];
  portfolio: PortfolioItemDto[];
}

/**
 * A blogger's profile as brands see it. Used on the brand's blogger page and in the blogger's own
 * "See how it looks" preview, so the two never drift apart.
 */
export function InfluencerPublicProfile({ p }: { p: PublicInfluencer }) {
  const t = useTranslations('applications.brand');
  const tp = useTranslations('portfolio.view');
  const o = useOptions();
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
    </Stack>
  );
}
