'use client';
import { Alert, Card, Container, Heading, Stack, Text } from '@briefluence/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SUPPORT_KEY, SupportChat } from '@/components/support/SupportChat';
import { api } from '@/lib/api';
import { LIVE, reconnectLive, useLive } from '@/lib/hooks/live';
import type { SupportViewDto } from '@/lib/types';

/**
 * Full-page support chat. Emailed reply links land here as /support?t=<token>: the token is
 * exchanged for the guest cookie, then removed from the address bar.
 */
export default function SupportPage() {
  const t = useTranslations('support.page');
  const qc = useQueryClient();
  const router = useRouter();
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('t');
    if (!token) {
      setReady(true);
      return;
    }
    api
      .post<SupportViewDto>('/support/resume', { token })
      .then((view) => {
        qc.setQueryData(SUPPORT_KEY, view);
        reconnectLive();
      })
      .catch(() => setLinkInvalid(true))
      .finally(() => {
        router.replace('/support');
        setReady(true);
      });
  }, [qc, router]);

  useLive(LIVE.support, () => void qc.invalidateQueries({ queryKey: SUPPORT_KEY }), ready);

  return (
    <Container size="md" py={{ base: 8, md: 12 }}>
      <Stack gap={6}>
        <Stack gap={2}>
          <Heading level={1}>{t('title')}</Heading>
          <Text tone="muted">{t('lead')}</Text>
        </Stack>
        {linkInvalid && <Alert tone="info">{t('linkInvalid')}</Alert>}
        <Card p={0} className="flex h-[min(44rem,calc(100dvh-12rem))] flex-col overflow-hidden">
          {ready && <SupportChat active />}
        </Card>
      </Stack>
    </Container>
  );
}
