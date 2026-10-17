'use client';
import { Alert, Button, Card, Container, Heading, Stack, Text, cn } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Logo } from '@/components/common/Logo';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';

type Card = 'success' | 'decline' | 'renewal_decline';

/** Development stand-in for the Ameriabank payment page (PAYMENT_PROVIDER=mock only). */
function MockCheckout() {
  const t = useTranslations('billing.mock');
  const params = useSearchParams();
  const f = useFormat();
  const errorMessage = useErrorMessage();
  const [card, setCard] = useState<Card>('success');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paymentID = params.get('paymentID') ?? '';
  const amount = Number(params.get('amount') ?? 0);
  const currency = (params.get('currency') ?? 'USD') as 'USD' | 'AMD';

  const pay = async () => {
    setBusy(true);
    try {
      const { redirectUrl } = await api.post<{ redirectUrl: string }>('/billing/mock/complete', { paymentID, card });
      window.location.href = redirectUrl;
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  const cards: { value: Card; mask: string }[] = [
    { value: 'success', mask: '4111 1111 1111 1111' },
    { value: 'renewal_decline', mask: '4000 0000 0000 0002' },
    { value: 'decline', mask: '4000 0000 0000 9995' },
  ];

  return (
    <Container size="sm" py={{ base: 6, md: 12 }}>
      <Stack gap={6}>
        <Logo />
        <Alert tone="warning">{t('notice')}</Alert>
        <Card>
          <Stack gap={4}>
            <Heading level={1} size="h2">
              {t('title')}
            </Heading>
            <Text size="small" tone="muted">
              {t('amount')}
            </Text>
            <span className="text-h1 font-extrabold text-ink">{f.money(amount, currency)}</span>
            {error && <Alert tone="danger">{error}</Alert>}
            <div role="radiogroup" className="flex flex-col gap-2">
              {cards.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={card === c.value}
                  onClick={() => setCard(c.value)}
                  className={cn('flex min-h-11 flex-col rounded-card border-2 px-4 py-2 text-left', card === c.value ? 'border-primary bg-primary-soft' : 'border-line')}
                >
                  <span className="font-bold tabular-nums text-ink">{c.mask}</span>
                  <span className="text-small text-ink-muted">{t(`cards.${c.value}`)}</span>
                </button>
              ))}
            </div>
            <Button size="lg" block loading={busy} disabled={!paymentID} onClick={pay}>
              {t('pay')}
            </Button>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}

export default function MockCheckoutPage() {
  return (
    <Suspense>
      <MockCheckout />
    </Suspense>
  );
}
