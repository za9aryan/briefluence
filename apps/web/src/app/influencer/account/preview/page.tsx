'use client';
import { Alert, ErrorState, Icon, Skeleton, Stack, buttonStyles } from '@briefluence/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { PageHeader } from '@/components/app/AppShell';
import {
  InfluencerPublicProfile,
  type PublicInfluencer,
} from '@/components/influencer/PublicProfile';
import { api } from '@/lib/api';
import type { VerificationStatus } from '@briefluence/shared';

/** "See how it looks": the blogger's profile exactly as a brand sees it (before acceptance). */
export default function ProfilePreviewPage() {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  const q = useQuery({
    queryKey: ['influencer', 'preview'],
    queryFn: () =>
      api.get<PublicInfluencer & { status: VerificationStatus }>('/influencers/me/public'),
  });
  return (
    <Stack gap={6}>
      <PageHeader
        title={t('previewTitle')}
        back={{ href: '/influencer/account', label: t('backToAccount') }}
        actions={
          <Link
            href="/influencer/account"
            className={buttonStyles({ variant: 'secondary', size: 'sm' })}
          >
            <Icon name="edit" /> {t('editProfile')}
          </Link>
        }
      />
      {q.isLoading ? (
        <Skeleton className="h-96 rounded-card" />
      ) : !q.data ? (
        <ErrorState title={tc('errorTitle')} />
      ) : (
        <>
          <Alert tone={q.data.status === 'APPROVED' ? 'info' : 'warning'}>
            {q.data.status === 'APPROVED' ? t('previewNote') : t('previewHidden')}
          </Alert>
          <InfluencerPublicProfile p={q.data} />
        </>
      )}
    </Stack>
  );
}
