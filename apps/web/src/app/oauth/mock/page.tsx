'use client';
import { Alert, Button, Card, Container, Field, Heading, Input, Stack } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Logo } from '@/components/common/Logo';

/** Development stand-in for the Google / Apple consent screen (OAUTH_LOGIN_MOCK only). */
function MockConsent() {
  const t = useTranslations('auth.social.mock');
  const params = useSearchParams();
  const provider = params.get('provider') === 'apple' ? 'Apple' : 'Google';
  const state = params.get('state') ?? '';
  const redirect = params.get('redirect') ?? '';
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  const go = () => {
    const code = `mock:${btoa(unescape(encodeURIComponent(JSON.stringify({ email, name }))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')}`;
    window.location.href = `${redirect}?${new URLSearchParams({ code, state })}`;
  };

  return (
    <Container size="sm" py={{ base: 6, md: 12 }}>
      <Stack gap={6}>
        <Logo />
        <Alert tone="warning">{t('notice', { provider })}</Alert>
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) go();
            }}
          >
            <Stack gap={4}>
              <Heading level={1} size="h2">
                {t('title', { provider })}
              </Heading>
              <Field label={t('email')}>
                {({ id }) => (
                  <Input
                    id={id}
                    type="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                )}
              </Field>
              <Field label={t('name')}>
                {({ id }) => (
                  <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />
                )}
              </Field>
              <Button type="submit" block disabled={!valid || !redirect}>
                {t('continue')}
              </Button>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Container>
  );
}

export default function MockConsentPage() {
  return (
    <Suspense>
      <MockConsent />
    </Suspense>
  );
}
