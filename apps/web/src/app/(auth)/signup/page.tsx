'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, type SignupInput } from '@briefluence/shared';
import {
  Button,
  Card,
  Checkbox,
  Heading,
  Icon,
  Stack,
  Text,
  cn,
  type IconName,
} from '@briefluence/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FormError, TextField, useFieldError, useServerErrors } from '@/components/forms/form';
import { PasswordField } from '@/components/forms/PasswordInput';
import { SocialSignIn } from '@/components/auth/SocialSignIn';
import { api } from '@/lib/api';
import { landingPath, ME_KEY, type Me } from '@/lib/hooks/session';

const ROLES: { value: SignupInput['role']; icon: IconName }[] = [
  { value: 'BRAND', icon: 'building' },
  { value: 'INFLUENCER', icon: 'user' },
];

function SignupForm() {
  const t = useTranslations('auth');
  const fe = useFieldError();
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const initialRole = params.get('role') === 'INFLUENCER' ? 'INFLUENCER' : 'BRAND';
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      role: initialRole,
      email: '',
      password: '',
      acceptTerms: false as unknown as true,
    },
  });
  const serverError = useServerErrors(form.setError);
  const role = form.watch('role');

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const me = await api.post<Me>('/auth/signup', values);
      qc.setQueryData(ME_KEY, me);
      router.replace(landingPath(me));
      router.refresh();
    } catch (e) {
      setError(serverError(e));
    }
  });

  return (
    <Card p={{ base: 6, md: 8 }}>
      <form onSubmit={onSubmit} noValidate>
        <Stack gap={4}>
          <FormError message={error} />
          <fieldset>
            <legend className="mb-2 text-small font-bold text-ink">{t('iAm')}</legend>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <div role="radiogroup" className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => {
                    const on = field.value === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => field.onChange(r.value)}
                        className={cn(
                          'flex min-h-11 min-w-0 flex-col items-start gap-1 rounded-card border-2 p-4 text-left transition-colors',
                          on
                            ? 'border-primary bg-primary-soft'
                            : 'border-line bg-surface-raised hover:border-primary/40',
                        )}
                      >
                        <Icon name={r.icon} size="md" tone={on ? 'accent' : 'muted'} />
                        <span className="text-body font-bold text-ink">
                          {t(`role.${r.value}.title`)}
                        </span>
                        <span className="max-w-full break-words text-small text-ink-muted">
                          {t(`role.${r.value}.body`)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </fieldset>
          {/* Social sign-up uses the chosen role; the terms checkbox below must be ticked first. */}
          <SocialSignIn
            role={role}
            beforeStart={() => {
              if (form.getValues('acceptTerms')) return true;
              form.setError('acceptTerms', { type: 'custom', message: 'acceptTerms' });
              return false;
            }}
          />
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
            autoComplete="new-password"
            label={t('password')}
            hint={t('passwordHint')}
            register={form.register}
            error={form.formState.errors.password}
          />
          <div>
            <Checkbox
              {...form.register('acceptTerms')}
              label={t.rich('acceptTerms', {
                terms: (c) => (
                  <Link
                    href="/terms"
                    target="_blank"
                    className="font-bold text-primary-text hover:underline"
                  >
                    {c}
                  </Link>
                ),
                privacy: (c) => (
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="font-bold text-primary-text hover:underline"
                  >
                    {c}
                  </Link>
                ),
              })}
            />
            {form.formState.errors.acceptTerms && (
              <Text size="small" tone="danger" className="mt-1 pl-7">
                {fe(form.formState.errors.acceptTerms)}
              </Text>
            )}
          </div>
          <Button type="submit" block loading={form.formState.isSubmitting}>
            {role === 'BRAND' ? t('signupBrandCta') : t('signupInfluencerCta')}
          </Button>
        </Stack>
      </form>
    </Card>
  );
}

export default function SignupPage() {
  const t = useTranslations('auth');
  return (
    <>
      <Stack gap={2}>
        <Heading level={1} size="h1">
          {t('signupTitle')}
        </Heading>
        <Text tone="muted">
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-bold text-primary-text hover:underline">
            {t('loginLink')}
          </Link>
        </Text>
      </Stack>
      <Suspense>
        <SignupForm />
      </Suspense>
    </>
  );
}
