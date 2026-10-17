'use client';
import { Card, Stack } from '@briefluence/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/app/AppShell';
import { BrandProfileForm } from '@/components/brand/BrandProfileForm';
import { ME_KEY } from '@/lib/hooks/session';

export default function BrandOnboardingPage() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const qc = useQueryClient();
  return (
    <Stack gap={6} className="mx-auto w-full max-w-3xl">
      <PageHeader title={t('brandTitle')} description={t('brandLead')} />
      <Card>
        <BrandProfileForm
          submitLabel={t('finishBrand')}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ME_KEY });
            router.push('/brand/deals/new');
          }}
        />
      </Card>
    </Stack>
  );
}
