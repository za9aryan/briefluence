'use client';
import { Alert, Card, Heading, Icon, Spinner, Stack, Text, buttonStyles } from '@briefluence/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { landingPath, ME_KEY, useMe } from '@/lib/hooks/session';

function Verify() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const token = useSearchParams().get('token');
  const qc = useQueryClient();
  const { data: me } = useMe();
  const errorMessage = useErrorMessage();
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>(token ? 'loading' : 'idle');
  const [error, setError] = useState('');
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    api
      .post('/auth/verify-email', { token })
      .then(() => {
        setState('ok');
        void qc.invalidateQueries({ queryKey: ME_KEY });
      })
      .catch((e) => {
        setError(errorMessage(e));
        setState('error');
      });
  }, [token, qc, errorMessage]);

  if (state === 'loading') return <Spinner label={tc('loading')} />;
  return (
    <Card p={{ base: 6, md: 8 }}>
      <Stack gap={4} align="center" className="text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-pill bg-primary-soft">
          <Icon name={state === 'ok' ? 'check-circle' : 'mail'} size="lg" tone={state === 'ok' ? 'success' : 'accent'} />
        </span>
        <Heading level={1} size="h2">
          {state === 'ok' ? t('verifiedTitle') : t('checkInboxTitle')}
        </Heading>
        <Text tone="muted">{state === 'ok' ? t('verifiedBody') : t('checkInboxBody')}</Text>
        {state === 'error' && <Alert tone="danger">{error}</Alert>}
        <Link href={me ? landingPath(me) : '/login'} className={buttonStyles({})}>
          {me ? t('continueToApp') : t('loginLink')}
        </Link>
      </Stack>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
