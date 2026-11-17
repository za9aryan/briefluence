'use client';
import type { CouponProblem, PlanCode } from '@briefluence/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Heading,
  Icon,
  Inline,
  Stack,
  Field,
  Input,
  Text,
  buttonStyles,
  cn,
  useConfirm,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import gift from './FreeProGift.module.css';
import { ApiError, api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { type CheckoutResponse, useRunCheckout } from '@/lib/hooks/checkout';
import { useFormat } from '@/lib/hooks/format';
import { ME_KEY, useMe } from '@/lib/hooks/session';
import type { PlanDto, SubscriptionDto } from '@/lib/types';

export const useSubscription = () =>
  useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => api.get<SubscriptionDto>('/billing/subscription'),
  });

/** A coupon the blogger checked (what it gives and on which plans). */
export interface CouponDto {
  code: string;
  percentOff: number;
  billingPeriods: number | null;
  plans: PlanCode[];
}

/** "Free for 3 months" / "50% off on every payment" for one plan. */
function useCouponDeal() {
  const t = useTranslations('billing.coupon');
  return (c: CouponDto, plan: PlanCode) => {
    const deal = c.percentOff >= 100 ? t('free') : t('off', { percent: c.percentOff });
    const when =
      c.billingPeriods == null || plan === 'BASIC'
        ? t('always')
        : t(`periods.${plan}`, { count: c.billingPeriods });
    return `${deal} ${when}`;
  };
}

/** How much free Pro is left, as words ("12 days", or "40 minutes" → "1 hour" in test mode). */
function useTimeLeft() {
  const t = useTranslations('billing.plans.duration');
  return (until: string) => {
    const hours = Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 3_600_000));
    return hours < 24 ? t('hours', { count: hours }) : t('days', { count: Math.ceil(hours / 24) });
  };
}

/**
 * Picks a plan. Basic is free and starts right away; Pro opens the payment (test page redirect or
 * Paddle overlay), with a coupon when one is applied. Paying during the free month ends it, so the
 * blogger confirms that first. `upgrade`: only Pro plans.
 */
function usePlanAction() {
  const t = useTranslations('billing');
  const toast = useToast();
  const confirm = useConfirm();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const runCheckout = useRunCheckout();
  const timeLeft = useTimeLeft();
  return useMutation({
    mutationFn: async ({ plan, coupon }: { plan: PlanCode; coupon?: string }) => {
      if (plan === 'BASIC') {
        await api.post('/billing/plan', { plan });
        return 'basic' as const;
      }
      const s = qc.getQueryData<SubscriptionDto>(['billing', 'subscription'])?.subscription;
      if (s?.inFreeDays && s.freeDaysLost > 0) {
        const ok = await confirm({
          title: t('loseFreeDays.title'),
          description: t('loseFreeDays.body', { duration: timeLeft(s.trialEndsAt) }),
          confirmLabel: t('loseFreeDays.confirm'),
          tone: 'primary',
        });
        if (!ok) return null;
      }
      // Paddle opens an overlay; the mutation stays pending until it is closed.
      await runCheckout(await api.post<CheckoutResponse>('/billing/checkout', { plan, coupon }));
      return null;
    },
    onSuccess: (r) => {
      if (!r) return;
      for (const key of [ME_KEY, ['billing'], ['influencer'], ['feed'], ['deal']])
        void qc.invalidateQueries({ queryKey: key });
      toast(t('plans.basicChosen'));
    },
    onError: (e) => {
      void qc.invalidateQueries({ queryKey: ['billing'] });
      void qc.invalidateQueries({ queryKey: ME_KEY });
      toast(errorMessage(e), 'danger');
    },
  });
}

export function PlanPicker({ mode, className }: { mode: 'start' | 'upgrade'; className?: string }) {
  const t = useTranslations('billing.plans');
  const tc = useTranslations('billing.coupon');
  const f = useFormat();
  const sub = useSubscription();
  const paddle = sub.data?.paddle;
  const action = usePlanAction();
  const couponDeal = useCouponDeal();
  const [coupon, setCoupon] = useState<CouponDto | null>(null);
  const plans = (sub.data?.plans ?? []).filter((p) => mode === 'start' || p.code !== 'BASIC');
  const monthly = plans.find((p) => p.code === 'PRO_MONTHLY');

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
          t('features.limit', { count: p.applicationLimit ?? 0 }),
          ...(p.offerLimit != null ? [t('features.offers', { count: p.offerLimit })] : []),
          t('features.feed'),
        ]
      : [
          t('features.unlimited'),
          t('features.offersUnlimited'),
          p.code === 'PRO_YEARLY'
            ? t('features.yearly')
            : p.code === 'PRO_DAILY'
              ? t('features.daily')
              : t('features.cancel'),
        ];
  const cta: Record<PlanCode, string> = {
    BASIC: t('chooseBasic'),
    PRO_DAILY: t('chooseDaily'),
    PRO_MONTHLY: t('choosePro'),
    PRO_YEARLY: t('chooseYearly'),
  };

  return (
    <Stack gap={4} className={className}>
      <Stack gap={1}>
        <Heading level={2} size="h2">
          {mode === 'start' ? t('title') : t('upgradeTitle')}
        </Heading>
        <Text tone="muted">{mode === 'upgrade' ? t('upgradeLead') : t('lead')}</Text>
      </Stack>
      {paddle?.demo && mode === 'start' && <DemoNote />}
      {sub.data?.coupons && <CouponField value={coupon} onChange={setCoupon} />}
      <Grid
        cols={
          plans.length >= 4 ? { base: 1, md: 2, xl: 4 } : { base: 1, md: plans.length >= 3 ? 3 : 2 }
        }
        gap={4}
      >
        {plans.map((p) => {
          const pro = p.code !== 'BASIC';
          const pct = saving(p);
          // An applied coupon only works on its plans; Basic is free anyway.
          const fits = !!coupon && pro && coupon.plans.includes(p.code);
          const blocked = !!coupon && pro && !fits;
          return (
            <Card
              key={p.code}
              className={cn(
                'flex flex-col',
                fits
                  ? 'border-2 border-success'
                  : p.code === 'PRO_MONTHLY' && !coupon && 'border-2 border-primary/40',
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
                  <span
                    className={cn(
                      'text-h1 font-extrabold text-ink',
                      fits && 'text-h2 text-ink-muted line-through',
                    )}
                  >
                    {price(p)}
                  </span>
                  {pro && <Text tone="muted">{periodLabel(t, p.code)}</Text>}
                </Inline>
                {fits && coupon && (
                  <Stack gap={1}>
                    <Badge tone="success" icon="gift" variant="small" className="self-start">
                      {couponDeal(coupon, p.code)}
                    </Badge>
                    <Text size="small" tone="muted">
                      {tc('then')}
                    </Text>
                  </Stack>
                )}
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
                  loading={action.isPending && action.variables?.plan === p.code}
                  disabled={action.isPending || blocked}
                  onClick={() =>
                    action.mutate({ plan: p.code, coupon: fits ? coupon?.code : undefined })
                  }
                >
                  {cta[p.code]}
                </Button>
                {blocked ? (
                  <Text size="small" tone="muted">
                    {tc('notForPlan')}
                  </Text>
                ) : fits && coupon && coupon.percentOff >= 100 ? (
                  <Text size="small" tone="muted">
                    {tc('cardNote')}
                  </Text>
                ) : (
                  pro &&
                  paddle && (
                    <Text size="small" tone="muted">
                      {t('payNowNote')}
                    </Text>
                  )
                )}
              </Stack>
            </Card>
          );
        })}
      </Grid>
    </Stack>
  );
}

/** "Have a coupon?": checks the code with the API, then shows what it gives. */
function CouponField({
  value,
  onChange,
}: {
  value: CouponDto | null;
  onChange: (c: CouponDto | null) => void;
}) {
  const t = useTranslations('billing.coupon');
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const check = useMutation({
    mutationFn: (c: string) => api.post<CouponDto>('/billing/coupon/check', { code: c }),
    onSuccess: (c) => {
      setError(null);
      onChange(c);
    },
    onError: (e) => {
      const reason =
        e instanceof ApiError && e.code === 'COUPON_INVALID'
          ? (e.details as { reason?: CouponProblem } | undefined)?.reason
          : undefined;
      setError(reason ? t(`errors.${reason}`) : errorMessage(e));
    },
  });

  if (value)
    return (
      <div className="flex items-center gap-3 rounded-card border border-success bg-success/10 p-4">
        <Icon name="gift" tone="success" />
        <Text weight="bold" className="min-w-0 flex-1 whitespace-nowrap">
          {t('applied', { code: value.code })}
        </Text>
        <Button
          size="sm"
          variant="ghost"
          icon="close"
          aria-label={t('remove')}
          onClick={() => onChange(null)}
        >
          <span className="hidden sm:inline">{t('remove')}</span>
        </Button>
      </div>
    );
  if (!open)
    return (
      <Button variant="ghost" icon="gift" className="self-start" onClick={() => setOpen(true)}>
        {t('toggle')}
      </Button>
    );
  const valid = /^[A-Za-z0-9]{3,32}$/.test(code.trim());
  return (
    <form
      className="max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) check.mutate(code.trim());
      }}
    >
      <Field label={t('label')} error={error ?? undefined}>
        {({ id, describedBy }) => (
          <div className="flex gap-2">
            <Input
              id={id}
              aria-describedby={describedBy}
              value={code}
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={32}
              invalid={!!error}
              className="uppercase"
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
            />
            <Button type="submit" variant="secondary" loading={check.isPending} disabled={!valid}>
              {t('apply')}
            </Button>
          </div>
        )}
      </Field>
    </form>
  );
}

/** Confetti pieces on the gift card: position (%), color token, delay (s). */
const GIFT_CONFETTI = [
  [12, 14, 'var(--bf-primary)', 0],
  [26, 78, 'var(--bf-on-primary)', 1.2],
  [44, 10, 'var(--bf-chart-2)', 2.1],
  [58, 84, 'var(--bf-primary)', 0.6],
  [72, 18, 'var(--bf-chart-3)', 1.7],
  [86, 70, 'var(--bf-on-primary)', 2.8],
  [94, 30, 'var(--bf-primary)', 3.4],
] as const;

/**
 * The one free month of Pro as a gift: an animated card with the perks and an "Activate" button
 * (no card, nothing charged afterwards). Renders nothing once it was used or while Pro runs.
 */
export function FreeProBanner() {
  const t = useTranslations('billing');
  const tf = useTranslations('billing.plans.features');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const sub = useSubscription();
  const duration = useFreeProDuration(sub.data?.freeProHours);
  const activate = useMutation({
    mutationFn: () => api.post('/billing/free-pro'),
    onSuccess: () => {
      for (const key of [ME_KEY, ['billing'], ['influencer'], ['feed'], ['deal']])
        void qc.invalidateQueries({ queryKey: key });
      toast(t('plans.startedFor', { duration }));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  if (!sub.data?.freeProAvailable) return null;
  return (
    <section className={gift.stage} aria-labelledby="free-pro-gift">
      <div className={gift.confetti} aria-hidden>
        {GIFT_CONFETTI.map(([x, y, color, delay], i) => (
          <span
            key={i}
            className={gift.bit}
            style={{ left: `${x}%`, top: `${y}%`, background: color, animationDelay: `${delay}s` }}
          />
        ))}
      </div>
      <div className={gift.inner}>
        <div className={gift.gift} aria-hidden>
          <span className={gift.glow} />
          <span className={gift.spark} />
          <span className={gift.spark} />
          <span className={gift.spark} />
          <span className={gift.box} />
          <span className={gift.lid} />
          <span className={gift.month}>{t('freeMonth.month')}</span>
        </div>
        <Stack gap={2} className="min-w-0">
          <span className={gift.eyebrow}>
            <Icon name="gift" size="xs" />
            {t('freeMonth.eyebrow')}
          </span>
          <h2 id="free-pro-gift" className={gift.title}>
            {t.rich('freeMonth.title', { em: (c) => <em>{c}</em> })}
          </h2>
          <p className={gift.body}>{t('freeMonth.body', { duration })}</p>
          <ul className={gift.perks}>
            {[tf('unlimited'), tf('offersUnlimited'), t('freeMonth.noCard')].map((x) => (
              <li key={x} className={gift.perk}>
                <Icon name="check" size="xs" />
                {x}
              </li>
            ))}
          </ul>
        </Stack>
        <div className={gift.cta}>
          <Button
            size="lg"
            icon="sparkles"
            className={gift.ctaButton}
            loading={activate.isPending}
            onClick={() => activate.mutate()}
          >
            {t('freeMonth.cta')}
          </Button>
          <p className={gift.ctaNote}>{t('freeMonth.note')}</p>
        </div>
      </div>
    </section>
  );
}

/** "per day / month / year" for a Pro plan. */
export function periodLabel(
  tPlans: (key: 'perDay' | 'perMonth' | 'perYear') => string,
  code: PlanCode,
) {
  return code === 'PRO_YEARLY'
    ? tPlans('perYear')
    : code === 'PRO_DAILY'
      ? tPlans('perDay')
      : tPlans('perMonth');
}

/** The free Pro period as words: "1 hour" in test mode, "30 days" live. */
export function useFreeProDuration(hours: number | undefined) {
  const t = useTranslations('billing.plans.duration');
  const h = hours ?? 24 * 30;
  return h < 24 ? t('hours', { count: h }) : t('days', { count: Math.round(h / 24) });
}

/** Sandbox (demo) mode: short periods and Paddle's test card, no real money. */
export function DemoNote() {
  const t = useTranslations('billing.demo');
  return (
    <Alert tone="info" title={t('title')}>
      {t('body', { card: '4242 4242 4242 4242' })}
    </Alert>
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
