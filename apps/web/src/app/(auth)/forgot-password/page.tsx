'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@briefluence/shared';
import { Alert, Button, Card, Heading, Stack, Text } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormError, TextField, useServerErrors } from '@/components/forms/form';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });
  const serverError = useServerErrors(form.setError);
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await api.post('/auth/forgot-password', v);
      setSent(true);
    } catch (e) {
      setError(serverError(e));
    }
  });
  return (
    <>
      <Stack gap={2}>
        <Heading level={1} size="h1">
          {t('forgotTitle')}
        </Heading>
        <Text tone="muted">{t('forgotLead')}</Text>
      </Stack>
      <Card p={{ base: 6, md: 8 }}>
        {sent ? (
          <Alert tone="success" title={t('resetSentTitle')}>
            {t('resetSentBody')}
          </Alert>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <Stack gap={4}>
              <FormError message={error} />
              <TextField name="email" type="email" autoComplete="email" label={t('email')} register={form.register} error={form.formState.errors.email} />
              <Button type="submit" block loading={form.formState.isSubmitting}>
                {t('sendResetLink')}
              </Button>
            </Stack>
          </form>
        )}
      </Card>
      <Text size="small" align="center">
        <Link href="/login" className="font-bold text-primary-text hover:underline">
          {t('backToLogin')}
        </Link>
      </Text>
    </>
  );
}
