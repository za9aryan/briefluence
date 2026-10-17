'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, type ChangePasswordInput } from '@briefluence/shared';
import { Button, Card, CardHeader, FieldGrid, Stack, useToast } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { FormError, useServerErrors } from './form';
import { PasswordField } from './PasswordInput';

export function ChangePasswordCard() {
  const t = useTranslations('account');
  const ta = useTranslations('auth');
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });
  const serverError = useServerErrors(form.setError);
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await api.post('/auth/change-password', v);
      form.reset({ currentPassword: '', newPassword: '' });
      toast(t('passwordChanged'));
    } catch (e) {
      setError(serverError(e));
    }
  });
  return (
    <Card>
      <CardHeader title={t('password')} description={t('passwordHint')} />
      <form onSubmit={onSubmit} noValidate>
        <Stack gap={4}>
          <FormError message={error} />
          <FieldGrid cols={{ base: 1, md: 2 }} gap={4}>
            <PasswordField name="currentPassword" autoComplete="current-password" label={t('currentPassword')} register={form.register} error={form.formState.errors.currentPassword} />
            <PasswordField name="newPassword" autoComplete="new-password" label={ta('newPassword')} hint={ta('passwordHint')} register={form.register} error={form.formState.errors.newPassword} />
          </FieldGrid>
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" loading={form.formState.isSubmitting}>
              {t('changePassword')}
            </Button>
          </div>
        </Stack>
      </form>
    </Card>
  );
}
