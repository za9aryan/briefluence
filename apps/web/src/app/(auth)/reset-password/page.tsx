'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@briefluence/shared';
import { Alert, Button, Card, Heading, Stack, buttonStyles } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormError, useServerErrors } from '@/components/forms/form';
import { PasswordField } from '@/components/forms/PasswordInput';
import { api } from '@/lib/api';

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'passwordsMismatch', path: ['confirm'] });
type Values = z.infer<typeof schema>;

function ResetForm() {
  const t = useTranslations('auth');
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const serverError = useServerErrors(form.setError);
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await api.post('/auth/reset-password', { token, password: v.password });
      setDone(true);
    } catch (e) {
      setError(serverError(e));
    }
  });

  if (done) {
    return (
      <Card p={{ base: 6, md: 8 }}>
        <Stack gap={4}>
          <Alert tone="success" title={t('resetDoneTitle')}>
            {t('resetDoneBody')}
          </Alert>
          <Link href="/login" className={buttonStyles({ block: true })}>
            {t('loginLink')}
          </Link>
        </Stack>
      </Card>
    );
  }
  return (
    <Card p={{ base: 6, md: 8 }}>
      <form onSubmit={onSubmit} noValidate>
        <Stack gap={4}>
          {!token && <Alert tone="danger">{t('resetNoToken')}</Alert>}
          <FormError message={error} />
          <PasswordField name="password" autoComplete="new-password" label={t('newPassword')} hint={t('passwordHint')} register={form.register} error={form.formState.errors.password} />
          <PasswordField name="confirm" autoComplete="new-password" label={t('confirmPassword')} register={form.register} error={form.formState.errors.confirm} />
          <Button type="submit" block disabled={!token} loading={form.formState.isSubmitting}>
            {t('setPassword')}
          </Button>
        </Stack>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  return (
    <>
      <Heading level={1} size="h1">
        {t('resetTitle')}
      </Heading>
      <Suspense>
        <ResetForm />
      </Suspense>
    </>
  );
}
