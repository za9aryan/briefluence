'use client';
import { useToast } from '@briefluence/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { api } from '@/lib/api';
import { ME_KEY } from '@/lib/hooks/session';
import { openPaddleCheckout, type PaddleCheckoutPayload } from '@/lib/paddle';
import type { SubscriptionDto } from '@/lib/types';

export type CheckoutResponse = { redirectUrl: string } | { paddle: PaddleCheckoutPayload };

const SUB_KEY = ['billing', 'subscription'];

/**
 * Runs what `POST /billing/checkout` returned: the bank page (redirect) or the Paddle overlay.
 * After a Paddle payment the plan is switched by the webhook a few seconds later, so we poll the
 * subscription until the card is linked (or give up after ~30 s and just refresh).
 */
export function useRunCheckout() {
  const t = useTranslations('billing');
  const toast = useToast();
  const locale = useLocale();
  const qc = useQueryClient();

  const refresh = useCallback(() => {
    for (const key of [ME_KEY, ['billing'], ['influencer'], ['feed'], ['deal']])
      void qc.invalidateQueries({ queryKey: key });
  }, [qc]);

  const waitForWebhook = useCallback(
    async (done: (s: SubscriptionDto) => boolean) => {
      for (let i = 0; i < 15; i++) {
        const s = await qc.fetchQuery({
          queryKey: SUB_KEY,
          queryFn: () => api.get<SubscriptionDto>('/billing/subscription'),
          staleTime: 0,
        });
        if (done(s)) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      refresh();
    },
    [qc, refresh],
  );

  return useCallback(
    async (r: CheckoutResponse) => {
      if ('redirectUrl' in r) {
        window.location.href = r.redirectUrl;
        return;
      }
      const cfg = qc.getQueryData<SubscriptionDto>(SUB_KEY)?.paddle;
      if (!cfg) throw new Error('Paddle is not configured');
      const result = await openPaddleCheckout(cfg, { checkout: r.paddle }, locale);
      if (result !== 'completed') return refresh();
      toast(t('paidToast'));
      await waitForWebhook((s) => !!s.subscription?.hasCard);
    },
    [qc, locale, toast, t, refresh, waitForWebhook],
  );
}

/** Paddle: change the card on the running subscription (Paddle.js opens a $0 transaction). */
export function useUpdateCard() {
  const t = useTranslations('billing');
  const toast = useToast();
  const locale = useLocale();
  const qc = useQueryClient();
  return useCallback(async () => {
    const cfg = qc.getQueryData<SubscriptionDto>(SUB_KEY)?.paddle;
    if (!cfg) return;
    const { transactionId } = await api.post<{ transactionId: string }>('/billing/payment-method');
    const result = await openPaddleCheckout(cfg, { transactionId }, locale);
    if (result === 'completed') toast(t('cardUpdatedToast'));
    void qc.invalidateQueries({ queryKey: ['billing'] });
  }, [qc, locale, toast, t]);
}
