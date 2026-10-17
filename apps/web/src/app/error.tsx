'use client';
import { Button, Container, Heading, LogoMark, Stack, Text } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('common');
  const te = useTranslations('errors');
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Container size="sm" className="flex min-h-[60dvh] items-center">
      <Stack gap={4} align="center" className="w-full text-center">
        <LogoMark className="size-16 text-primary" />
        <Heading level={1} size="h1">
          {t('errorTitle')}
        </Heading>
        <Text tone="muted">{te('generic')}</Text>
        <Button onClick={reset}>{t('retry')}</Button>
      </Stack>
    </Container>
  );
}
