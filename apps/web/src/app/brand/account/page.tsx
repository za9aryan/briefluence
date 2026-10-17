'use client';
import { Card, CardHeader, Skeleton, Stack, Switch, useToast } from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/AppShell';
import { BrandProfileForm } from '@/components/brand/BrandProfileForm';
import { ChangePasswordCard } from '@/components/forms/ChangePasswordCard';
import { api } from '@/lib/api';
import { ME_KEY, useMe } from '@/lib/hooks/session';
import type { BrandProfileDto } from '@/lib/types';

export default function BrandAccountPage() {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  const toast = useToast();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const brand = useQuery({ queryKey: ['brand', 'me'], queryFn: () => api.get<BrandProfileDto>('/brands/me') });
  const settings = useMutation({
    mutationFn: (digestEmails: boolean) => api.patch('/auth/settings', { digestEmails }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ME_KEY });
      toast(tc('saved'));
    },
  });
  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} description={t('brandLead')} />
      <Card>
        <CardHeader title={t('profile')} />
        {brand.isLoading ? (
          <Skeleton className="h-96" />
        ) : (
          <BrandProfileForm
            initial={brand.data}
            submitLabel={tc('save')}
            onSaved={(b) => {
              qc.setQueryData(['brand', 'me'], b);
              void qc.invalidateQueries({ queryKey: ME_KEY });
              toast(tc('saved'));
            }}
          />
        )}
      </Card>
      <Card>
        <CardHeader title={t('notifications')} />
        <Switch checked={me?.digestEmails ?? true} disabled={settings.isPending} onChange={(v) => settings.mutate(v)} label={t('digest')} description={t('digestHint')} />
      </Card>
      <ChangePasswordCard />
    </Stack>
  );
}
