'use client';
import { Card, CardHeader, Skeleton, Stack, Switch, useToast } from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/AppShell';
import { ChangePasswordCard } from '@/components/forms/ChangePasswordCard';
import { InfluencerProfileForm } from '@/components/influencer/ProfileForm';
import { FaqCard, PortfolioCard } from '@/components/influencer/PortfolioSettings';
import { api } from '@/lib/api';
import { ME_KEY, useMe } from '@/lib/hooks/session';
import type { InfluencerProfileDto } from '@/lib/types';

export default function InfluencerAccountPage() {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  const toast = useToast();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const profile = useQuery({
    queryKey: ['influencer', 'me'],
    queryFn: () => api.get<InfluencerProfileDto>('/influencers/me'),
  });
  const settings = useMutation({
    mutationFn: (digestEmails: boolean) => api.patch('/auth/settings', { digestEmails }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ME_KEY });
      toast(tc('saved'));
    },
  });

  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} description={t('influencerLead')} />
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
      <Card>
        <CardHeader title={t('notifications')} />
        <Switch
          checked={me?.digestEmails ?? true}
          disabled={settings.isPending}
          onChange={(v) => settings.mutate(v)}
          label={t('digest')}
          description={t('digestHint')}
        />
      </Card>
      <ChangePasswordCard />
    </Stack>
  );
}
