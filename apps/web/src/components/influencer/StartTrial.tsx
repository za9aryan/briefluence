'use client';
import { formatMoney } from '@briefluence/shared';
import { Badge, Button, Card, Heading, Icon, Inline, Stack, Text, buttonStyles, cn, useToast } from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { INTL_LOCALE, type Locale } from '@/i18n/config';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { ME_KEY, useMe } from '@/lib/hooks/session';
import type { SubscriptionDto } from '@/lib/types';

/** Shows the monthly price from the API so the terms always match what will be charged. */
function usePriceLabel() {
  const locale = useLocale() as Locale;
  const sub = useQuery({ queryKey: ['billing', 'subscription'], queryFn: () => api.get<SubscriptionDto>('/billing/subscription') });
  return sub.data ? formatMoney(sub.data.price.amount, sub.data.price.currency, INTL_LOCALE[locale]) : '…';
}

export function useStartTrial() {
  const t = useTranslations('billing.trial');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/billing/trial'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ME_KEY });
      void qc.invalidateQueries({ queryKey: ['billing'] });
      void qc.invalidateQueries({ queryKey: ['influencer'] });
      void qc.invalidateQueries({ queryKey: ['feed'] });
      void qc.invalidateQueries({ queryKey: ['deal'] });
      toast(t('started'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
}

/** The blogger explicitly accepts the free month; nothing starts automatically. */
export function StartTrialCard({ className }: { className?: string }) {
  const t = useTranslations('billing.trial');
  const price = usePriceLabel();
  const start = useStartTrial();
  return (
    <Card className={cn('border-2 border-primary/30', className)}>
      <Stack gap={4}>
        <Badge tone="primary" className="self-start">
          {t('badge')}
        </Badge>
        <Heading level={2} size="h2">
          {t('title')}
        </Heading>
        <Stack gap={2}>
          {(['a', 'b', 'c'] as const).map((k) => (
            <Inline key={k} gap={2} align="start">
              <Icon name="check" tone="success" className="mt-1" />
              <Text>{t(`terms.${k}`, { price })}</Text>
            </Inline>
          ))}
        </Stack>
        <Button size="lg" loading={start.isPending} onClick={() => start.mutate()} className="self-start">
          {t('cta')}
        </Button>
        <Text size="small" tone="muted">
          {t('note')}
        </Text>
      </Stack>
    </Card>
  );
}

/** "Two steps to see briefs": start the free month + get verified. Renders nothing when both are done. */
export function BriefsChecklist() {
  const t = useTranslations('billing.trial.checklist');
  const { data: me } = useMe();
  const start = useStartTrial();
  if (!me || me.role !== 'INFLUENCER') return null;
  const trialDone = !!me.subscription;
  const status = me.influencer?.status ?? 'DRAFT';
  const verifiedDone = status === 'APPROVED';
  if (trialDone && verifiedDone) return null;

  const step = (n: number, done: boolean, title: string, body: string, action: React.ReactNode) => (
    <li className="flex flex-col gap-4 border-b border-line py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <Inline gap={4} align="start">
        <span
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center rounded-pill text-small font-bold',
            done ? 'bg-success text-on-primary' : 'bg-primary-soft text-primary-text',
          )}
        >
          {done ? <Icon name="check" size="xs" /> : n}
        </span>
        <Stack gap={0}>
          <Text weight="bold">{title}</Text>
          <Text size="small" tone="muted">
            {body}
          </Text>
        </Stack>
      </Inline>
      <div className="shrink-0 pl-12 sm:pl-0">{action}</div>
    </li>
  );

  return (
    <Card>
      <Heading level={2} size="h2">
        {t('title')}
      </Heading>
      <Text size="small" tone="muted" className="mt-1">
        {t('lead')}
      </Text>
      <ul className="mt-2">
        {step(
          1,
          trialDone,
          t('trialTitle'),
          trialDone ? t('trialDone') : t('trialBody'),
          trialDone ? null : (
            <Button size="sm" loading={start.isPending} onClick={() => start.mutate()}>
              {t('trialCta')}
            </Button>
          ),
        )}
        {step(
          2,
          verifiedDone,
          t('verifyTitle'),
          t(`verifyBody.${status}`),
          verifiedDone ? null : (
            <Link href="/influencer/verification" className={buttonStyles({ size: 'sm', variant: 'secondary' })}>
              {t('verifyCta')}
            </Link>
          ),
        )}
      </ul>
    </Card>
  );
}
