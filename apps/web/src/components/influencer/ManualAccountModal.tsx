'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AUDIENCE_AGE_BUCKETS,
  manualAccountSchema,
  PLATFORMS,
  type ManualAccountInput,
  type Platform,
} from '@briefluence/shared';
import { Button, FieldGrid, Modal, Stack, Text, useToast } from '@briefluence/ui';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FormError, SelectField, TextField, useServerErrors } from '@/components/forms/form';
import { api } from '@/lib/api';
import { useOptions } from '@/lib/hooks/options';
import type { SocialAccountDto } from '@/lib/types';

type FormValues = z.input<typeof manualAccountSchema>;

const EMPTY: FormValues = {
  platform: 'INSTAGRAM',
  username: '',
  followers: undefined as unknown as number,
};

/** Prefills the form from a stored manual account (audience maps hold one entry each). */
function toValues(a: SocialAccountDto): FormValues {
  const [country, countryShare] = Object.entries(a.audienceCountries ?? {})[0] ?? [];
  const [age, ageShare] = Object.entries(a.audienceAge ?? {})[0] ?? [];
  return {
    platform: a.platform,
    username: a.username,
    followers: a.followers,
    profileUrl: a.profileUrl,
    avgViews: a.avgViews,
    engagementRate: a.engagementRate,
    audienceFemale: a.audienceGender?.female ?? null,
    topCountry: country ?? null,
    topCountryShare: countryShare ?? null,
    topAge: (age as FormValues['topAge']) ?? null,
    topAgeShare: ageShare ?? null,
  };
}

interface Props {
  open: boolean;
  account: SocialAccountDto | null;
  /** Platforms the blogger already has an account on (one per platform). */
  usedPlatforms: Platform[];
  onClose: () => void;
  onSaved: () => void;
}

/** Add (account = null) or edit a manually entered social account. Mounted fresh on every open. */
export function ManualAccountModal(props: Props) {
  return props.open ? <ManualAccountDialog key={props.account?.id ?? 'new'} {...props} /> : null;
}

function ManualAccountDialog({ open, account, usedPlatforms, onClose, onSaved }: Props) {
  const t = useTranslations('verification.manual');
  const tc = useTranslations('common');
  const o = useOptions();
  // When adding, only platforms without an account; when editing, also this account's own platform.
  const free = PLATFORMS.filter((p) => p === account?.platform || !usedPlatforms.includes(p));
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues, unknown, ManualAccountInput>({
    resolver: zodResolver(manualAccountSchema),
    defaultValues: account ? toValues(account) : { ...EMPTY, platform: free[0] ?? EMPTY.platform },
  });
  const serverError = useServerErrors(form.setError);
  const errors = form.formState.errors;

  const save = useMutation({
    mutationFn: (v: ManualAccountInput) =>
      account
        ? api.patch(`/social/accounts/${account.id}`, v)
        : api.post('/social/accounts/manual', v),
    onSuccess: () => {
      toast(account ? t('savedToast') : t('addedToast'));
      onSaved();
      onClose();
    },
    onError: (e) => setError(serverError(e)),
  });
  const submit = form.handleSubmit((v) => save.mutate(v));
  const num = {
    type: 'number',
    inputMode: 'decimal',
    valueAsNumber: true,
    register: form.register,
  } as const;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      closeLabel={tc('close')}
      title={account ? t('editTitle') : t('title')}
      description={t('lead')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            {account ? t('save') : t('add')}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Stack gap={6}>
          <FormError message={error} />
          <FieldGrid cols={{ base: 1, sm: 3 }}>
            <SelectField
              name="platform"
              label={t('platform')}
              required
              register={form.register}
              error={errors.platform}
              options={o.platforms.filter((x) => free.includes(x.value))}
            />
            <TextField
              name="username"
              label={t('username')}
              required
              placeholder="@"
              autoComplete="off"
              register={form.register}
              error={errors.username}
            />
            <TextField
              name="followers"
              label={t('followers')}
              required
              min={0}
              {...num}
              error={errors.followers}
            />
          </FieldGrid>
          <TextField
            name="profileUrl"
            type="url"
            label={t('profileUrl')}
            hint={t('profileUrlHint')}
            aside={tc('optional')}
            placeholder="https://"
            register={form.register}
            error={errors.profileUrl}
          />

          <Stack gap={2}>
            <Text weight="bold">
              {t('statsTitle')}{' '}
              <Text as="span" size="small" tone="muted">
                · {tc('optional')}
              </Text>
            </Text>
            <FieldGrid cols={{ base: 1, sm: 2 }}>
              <TextField
                name="avgViews"
                label={t('avgViews')}
                min={0}
                {...num}
                error={errors.avgViews}
              />
              <TextField
                name="engagementRate"
                label={t('engagementRate')}
                min={0}
                max={100}
                step="0.1"
                {...num}
                error={errors.engagementRate}
              />
            </FieldGrid>
          </Stack>

          <Stack gap={2}>
            <Text weight="bold">
              {t('audienceTitle')}{' '}
              <Text as="span" size="small" tone="muted">
                · {tc('optional')}
              </Text>
            </Text>
            <FieldGrid cols={{ base: 1, sm: 2 }}>
              <SelectField
                name="topCountry"
                label={t('topCountry')}
                placeholder={tc('notSet')}
                register={form.register}
                error={errors.topCountry}
                options={o.countries}
              />
              <TextField
                name="topCountryShare"
                label={t('topCountryShare')}
                min={0}
                max={100}
                step="0.1"
                {...num}
                error={errors.topCountryShare}
              />
              <SelectField
                name="topAge"
                label={t('topAge')}
                placeholder={tc('notSet')}
                register={form.register}
                error={errors.topAge}
                options={AUDIENCE_AGE_BUCKETS.map((b) => ({ value: b, label: b }))}
              />
              <TextField
                name="topAgeShare"
                label={t('topAgeShare')}
                min={0}
                max={100}
                step="0.1"
                {...num}
                error={errors.topAgeShare}
              />
              <TextField
                name="audienceFemale"
                label={t('audienceFemale')}
                min={0}
                max={100}
                step="0.1"
                {...num}
                error={errors.audienceFemale}
              />
            </FieldGrid>
          </Stack>
        </Stack>
      </form>
    </Modal>
  );
}
