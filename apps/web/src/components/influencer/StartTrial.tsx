'use client';
import type { PlanCode } from '@briefluence/shared';
import {
  Badge,
  Button,
  Card,
  Grid,
  Heading,
  Icon,
  Inline,
  Stack,
  Text,
  buttonStyles,
  cn,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import { ME_KEY, useMe } from '@/lib/hooks/session';
import type { PlanDto, SubscriptionDto } from '@/lib/types';

export const useSubscription = () =>
  useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => api.get<SubscriptionDto>('/billing/subscription'),
  });

/**
 * Picks a plan. `start`: the blogger has no plan yet — every plan starts with free Pro days, and
 * Pro also opens the bank page. `upgrade`: only Pro plans, straight to payment.
 */
function usePlanAction(mode: 'start' | 'upgrade') {
  const t = useTranslations('billing.plans');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: PlanCode) => {
      if (mode === 'start') await api.post('/billing/plan', { plan });
      if (plan === 'BASIC') return null;
      return api.post<{ redirectUrl: string }>('/billing/checkout', { plan });
    },
    onSuccess: (r) => {
      if (r?.redirectUrl) {
        window.location.href = r.redirectUrl;
        return;
      }
      for (const key of [ME_KEY, ['billing'], ['influencer'], ['feed'], ['deal']])
        void qc.invalidateQueries({ queryKey: key });
      toast(t('started'));
    },
    onError: (e) => {
      // A Pro choice still started the free days even if the bank page failed to open.
      void qc.invalidateQueries({ queryKey: ['billing'] });
      void qc.invalidateQueries({ queryKey: ME_KEY });
      toast(errorMessage(e), 'danger');
    },
  });
}

export function PlanPicker({ mode, className }: { mode: 'start' | 'upgrade'; className?: string }) {
  const t = useTranslations('billing.plans');
  const f = useFormat();
  const sub = useSubscription();
  const action = usePlanAction(mode);
  const plans = (sub.data?.plans ?? []).filter((p) => mode === 'start' || p.code !== 'BASIC');
  const monthly = plans.find((p) => p.code === 'PRO_MONTHLY');
  const freeDaysLeft = mode === 'start' || !!sub.data?.subscription?.inFreeDays;

  const price = (p: PlanDto) =>
    p.code === 'BASIC' ? t('free') : f.money(p.priceMinor, p.currency);
  const saving = (p: PlanDto) =>
    p.code === 'PRO_YEARLY' &&
    monthly &&
    monthly.currency === p.currency &&
    monthly.priceMinor * 12 > p.priceMinor
      ? Math.round((1 - p.priceMinor / (monthly.priceMinor * 12)) * 100)
      : null;
  const features = (p: PlanDto): string[] =>
    p.code === 'BASIC'
      ? [
          t('features.freeDays'),
          t('features.limit', { count: p.applicationLimit ?? 0 }),
          ...(p.offerLimit != null ? [t('features.offers', { count: p.offerLimit })] : []),
          t('features.feed'),
        ]
      : [
          ...(mode === 'start' ? [t('features.freeDays')] : []),
          t('features.unlimited'),
          t('features.offersUnlimited'),
          p.code === 'PRO_YEARLY' ? t('features.yearly') : t('features.cancel'),
        ];
  const cta: Record<PlanCode, string> = {
    BASIC: t('chooseBasic'),
    PRO_MONTHLY: t('choosePro'),
    PRO_YEARLY: t('chooseYearly'),
  };

  return (
    <Stack gap={4} className={className}>
      <Stack gap={1}>
        <Heading level={2} size="h2">
          {mode === 'start' ? t('title') : t('upgradeTitle')}
        </Heading>
        <Text tone="muted">{mode === 'start' ? t('lead') : t('upgradeLead')}</Text>
      </Stack>
      <Grid cols={{ base: 1, md: plans.length >= 3 ? 3 : 2 }} gap={4}>
        {plans.map((p) => {
          const pro = p.code !== 'BASIC';
          const pct = saving(p);
          return (
            <Card
              key={p.code}
              className={cn(
                'flex flex-col',
                p.code === 'PRO_MONTHLY' && 'border-2 border-primary/40',
              )}
            >
              <Stack gap={4} className="flex-1">
                <Inline justify="between" align="start">
                  <Text weight="bold" size="body">
                    {t(`name.${p.code}`)}
                  </Text>
                  {pct != null && <Badge tone="primary">{t('save', { value: `${pct}%` })}</Badge>}
                </Inline>
                <Inline gap={2} align="baseline" wrap>
                  <span className="text-h1 font-extrabold text-ink">{price(p)}</span>
                  {pro && (
                    <Text tone="muted">
                      {p.code === 'PRO_YEARLY' ? t('perYear') : t('perMonth')}
                    </Text>
                  )}
                </Inline>
                <Stack gap={2} className="flex-1">
                  {features(p).map((x) => (
                    <Inline key={x} gap={2} align="start">
                      <Icon name="check" tone="success" className="mt-1" />
                      <Text size="small">{x}</Text>
                    </Inline>
                  ))}
                </Stack>
                <Button
                  block
                  variant={pro ? 'primary' : 'secondary'}
                  loading={action.isPending && action.variables === p.code}
                  disabled={action.isPending}
                  onClick={() => action.mutate(p.code)}
                >
                  {cta[p.code]}
                </Button>
                {pro && freeDaysLeft && (
                  <Text size="small" tone="muted">
                    {t('payNote')}
                  </Text>
                )}
              </Stack>
            </Card>
          );
        })}
      </Grid>
    </Stack>
  );
}

/**
 * "Two steps": choose a plan + get verified. Renders nothing when both are done. `for` picks the
 * wording (seeing briefs or posting offers).
 */
/** Bloggers can see briefs / post offers only once verified and on a plan. */
export function useBloggerUnlocked() {
  const { data: me } = useMe();
  return { me, unlocked: !!me?.subscription && me.influencer?.status === 'APPROVED' };
}

export function BriefsChecklist({ for: purpose = 'briefs' }: { for?: 'briefs' | 'offers' } = {}) {
  const t = useTranslations('billing.checklist');
  const { data: me } = useMe();
  if (!me || me.role !== 'INFLUENCER') return null;
  const planDone = !!me.subscription;
  const status = me.influencer?.status ?? 'DRAFT';
  const verifiedDone = status === 'APPROVED';
  if (planDone && verifiedDone) return null;

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
        {purpose === 'offers' ? t('offersTitle') : t('title')}
      </Heading>
      <Text size="small" tone="muted" className="mt-1">
        {purpose === 'offers' ? t('offersLead') : t('lead')}
      </Text>
      <ul className="mt-2">
        {step(
          1,
          planDone,
          t('planTitle'),
          planDone ? t('planDone') : t('planBody'),
          planDone ? null : (
            <Link href="/influencer/billing" className={buttonStyles({ size: 'sm' })}>
              {t('planCta')}
            </Link>
          ),
        )}
        {step(
          2,
          verifiedDone,
          t('verifyTitle'),
          t(`verifyBody.${status}`),
          verifiedDone ? null : (
            <Link
              href="/influencer/verification"
              className={buttonStyles({ size: 'sm', variant: 'secondary' })}
            >
              {t('verifyCta')}
            </Link>
          ),
        )}
      </ul>
    </Card>
  );
}
