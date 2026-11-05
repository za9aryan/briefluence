'use client';
import { Card, CardHeader, Icon, Skeleton, Stack, buttonStyles, useToast } from '@briefluence/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { PageHeader } from '@/components/app/AppShell';
import { InfluencerProfileForm } from '@/components/influencer/ProfileForm';
import { FaqCard, PortfolioCard } from '@/components/influencer/PortfolioSettings';
import { UsernameCard } from '@/components/influencer/UsernameCard';
import { api } from '@/lib/api';
import { ME_KEY } from '@/lib/hooks/session';
import type { InfluencerProfileDto } from '@/lib/types';

/** The blogger's public side: profile, portfolio, FAQ, and a preview of how brands see it. */
export default function InfluencerAccountPage() {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  const toast = useToast();
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ['influencer', 'me'],
    queryFn: () => api.get<InfluencerProfileDto>('/influencers/me'),
  });

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('title')}
        description={t('influencerLead')}
        actions={
          <Link
            href="/influencer/account/preview"
            className={buttonStyles({ variant: 'secondary', size: 'sm' })}
          >
            <Icon name="eye" /> {t('preview')}
          </Link>
        }
      />
      {profile.data && (
        <UsernameCard
          profile={profile.data}
          onSaved={(p) => {
            qc.setQueryData(['influencer', 'me'], p);
            void qc.invalidateQueries({ queryKey: ['influencer', 'preview'] });
          }}
        />
      )}
      <Card>
        <CardHeader title={t('profile')} />
        {profile.isLoading ? (
          <Skeleton className="h-96" />
        ) : (
          <InfluencerProfileForm
            initial={profile.data}
            submitLabel={tc('save')}
            onSaved={(p) => {
              qc.setQueryData(['influencer', 'me'], p);
              void qc.invalidateQueries({ queryKey: ME_KEY });
              void qc.invalidateQueries({ queryKey: ['influencer', 'preview'] });
              toast(tc('saved'));
            }}
          />
        )}
      </Card>
      {profile.data && (
        <>
          <PortfolioCard />
          <FaqCard profile={profile.data} />
        </>
      )}
    </Stack>
  );
}
