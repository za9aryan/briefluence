'use client';
import { Card, CardHeader, Stack, Switch, Text, useToast } from '@briefluence/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/AppShell';
import { AppInstallCard } from '@/components/app/AppInstallCard';
import { PreferenceFields } from '@/components/app/Preferences';
import { ChangePasswordCard } from '@/components/forms/ChangePasswordCard';
import { api } from '@/lib/api';
import { ME_KEY, useMe } from '@/lib/hooks/session';

/** Settings for bloggers and brands: language, currency, emails, the app + push, password. */
export function SettingsView() {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  const toast = useToast();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const settings = useMutation({
    mutationFn: (digestEmails: boolean) => api.patch('/auth/settings', { digestEmails }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ME_KEY });
      toast(tc('saved'));
    },
  });
  return (
    <Stack gap={6}>
      <PageHeader title={t('settingsTitle')} description={t('settingsLead')} />
      <Card>
        <CardHeader title={t('preferences')} />
        <Stack gap={4}>
          <PreferenceFields className="max-w-md" />
          <Text size="small" tone="muted">
            {t('preferencesHint')}
          </Text>
        </Stack>
      </Card>
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
      <AppInstallCard />
      <ChangePasswordCard />
    </Stack>
  );
}
