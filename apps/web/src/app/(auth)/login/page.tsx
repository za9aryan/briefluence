'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type ErrorCode, type LoginInput } from '@briefluence/shared';
import { Button, Card, Heading, Stack, Text } from '@briefluence/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormError, TextField, useServerErrors } from '@/components/forms/form';
import { PasswordField } from '@/components/forms/PasswordInput';
import { SocialSignIn } from '@/components/auth/SocialSignIn';
import { api, ApiError } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { landingPath, ME_KEY, type Me } from '@/lib/hooks/session';

function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const oauthError = params.get('error');
  const [error, setError] = useState<string | null>(
    oauthError ? errorMessage(new ApiError(400, oauthError as ErrorCode, '')) : null,
  );
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const serverError = useServerErrors(form.setError);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const me = await api.post<Me>('/auth/login', values);
      qc.setQueryData(ME_KEY, me);
      const next = params.get('next');
      router.replace(
        next && next.startsWith('/') && !next.startsWith('//') ? next : landingPath(me),
      );
      router.refresh();
    } catch (e) {
      setError(serverError(e));
    }
  });

  return (
    <Card p={{ base: 6, md: 8 }}>
      <FormError message={error} />
      <div className={error ? 'mt-4' : undefined}>
        <SocialSignIn next={params.get('next')} />
      </div>
      <form onSubmit={onSubmit} noValidate>
        <Stack gap={4}>
          <TextField
            name="email"
            type="email"
            autoComplete="email"
            label={t('email')}
            register={form.register}
            error={form.formState.errors.email}
          />
          <PasswordField
            name="password"
            autoComplete="current-password"
            label={t('password')}
            register={form.register}
            error={form.formState.errors.password}
            aside={
              <Link href="/forgot-password" className="font-bold text-primary-text hover:underline">
                {t('forgot')}
              </Link>
            }
          />
          <Button type="submit" block loading={form.formState.isSubmitting}>
            {t('loginCta')}
          </Button>
        </Stack>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  const t = useTranslations('auth');
  return (
    <>
      <Stack gap={2}>
        <Heading level={1} size="h1">
          {t('loginTitle')}
        </Heading>
        <Text tone="muted">
          {t('noAccount')}{' '}
          <Link href="/signup" className="font-bold text-primary-text hover:underline">
            {t('signupLink')}
          </Link>
        </Text>
      </Stack>
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
