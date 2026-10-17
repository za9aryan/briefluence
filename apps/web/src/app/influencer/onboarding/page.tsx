'use client';
import { Card, Stack, Stepper } from '@briefluence/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/app/AppShell';
import { InfluencerProfileForm } from '@/components/influencer/ProfileForm';
import { ME_KEY } from '@/lib/hooks/session';

export default function InfluencerOnboardingPage() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const qc = useQueryClient();
  return (
    <Stack gap={6} className="mx-auto w-full max-w-3xl">
      <Stepper steps={[t('stepProfile'), t('stepConnect'), t('stepReview')]} current={0} />
      <PageHeader title={t('influencerTitle')} description={t('influencerLead')} />
      <Card>
        <InfluencerProfileForm
          submitLabel={t('saveAndContinue')}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ME_KEY });
            router.push('/influencer/verification');
          }}
        />
      </Card>
    </Stack>
  );
}
