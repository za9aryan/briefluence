'use client';
import {
  Alert,
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
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { landingPath, ME_KEY, type Me } from '@/lib/hooks/session';

const ROLES: { value: 'BRAND' | 'INFLUENCER'; icon: IconName }[] = [
  { value: 'BRAND', icon: 'building' },
  { value: 'INFLUENCER', icon: 'user' },
];

/** Last step of "Continue with Google / Apple" for someone new: pick a role and accept the terms. */
function CompleteSignup() {
  const t = useTranslations('auth');
  const tf = useTranslations('errors.field');
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [role, setRole] = useState<'BRAND' | 'INFLUENCER' | null>(null);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!role) return;
    if (!terms) {
      setError(tf('acceptTerms'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const me = await api.post<Me>('/auth/oauth/complete', { token, role, acceptTerms: true });
      qc.setQueryData(ME_KEY, me);
      router.replace(landingPath(me));
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <>
      <Stack gap={2}>
        <Heading level={1} size="h1">
          {t('social.completeTitle')}
        </Heading>
        <Text tone="muted">{t('social.completeLead')}</Text>
      </Stack>
      <Card p={{ base: 6, md: 8 }}>
        <Stack gap={4}>
          {!token && <Alert tone="danger">{t('resetNoToken')}</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}
          <div role="radiogroup" aria-label={t('iAm')} className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => {
              const on = role === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setRole(r.value)}
                  className={cn(
                    'flex min-h-11 flex-col items-start gap-1 rounded-card border-2 p-4 text-left transition-colors',
                    on
                      ? 'border-primary bg-primary-soft'
                      : 'border-line bg-surface-raised hover:border-primary/40',
                  )}
                >
                  <Icon name={r.icon} size="md" tone={on ? 'accent' : 'muted'} />
                  <span className="text-body font-bold text-ink">{t(`role.${r.value}.title`)}</span>
                  <span className="text-small text-ink-muted">{t(`role.${r.value}.body`)}</span>
                </button>
              );
            })}
          </div>
          <Checkbox
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
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
          <Button block disabled={!role || !token} loading={busy} onClick={submit}>
            {t('continueToApp')}
          </Button>
        </Stack>
      </Card>
    </>
  );
}

export default function CompleteSignupPage() {
  return (
    <Suspense>
      <CompleteSignup />
    </Suspense>
  );
}
