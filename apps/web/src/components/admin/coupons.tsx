'use client';
import type { Currency, PlanCode } from '@briefluence/shared';
import { Badge } from '@briefluence/ui';
import { useTranslations } from 'next-intl';

/** A coupon as admins see it (Admin → Coupons). */
export interface AdminCoupon {
  id: string;
  code: string;
  note: string | null;
  percentOff: number;
  billingPeriods: number | null;
  plans: PlanCode[];
  maxUses: number | null;
  usesLeft: number | null;
  expiresAt: string | null;
  active: boolean;
  state: 'ON' | 'OFF' | 'EXPIRED' | 'USED_UP';
  createdAt: string;
  createdBy: string | null;
  stats: { uses: number; paying: number; renewing: number; conversion: number };
}

export interface AdminCouponDetail extends AdminCoupon {
  paddleTimesUsed: number | null;
  redemptions: {
    id: string;
    email: string;
    name: string | null;
    username: string | null;
    planCode: PlanCode;
    firstAmount: number;
    currency: Currency;
    redeemedAt: string;
    paidAfter: number[];
    revenue: Partial<Record<Currency, number>>;
    renewing: boolean;
  }[];
}

const STATE_TONE = {
  ON: 'success',
  OFF: 'neutral',
  EXPIRED: 'primary',
  USED_UP: 'neutral',
} as const;

export function CouponStateBadge({ state }: { state: AdminCoupon['state'] }) {
  const t = useTranslations('admin.coupons.state');
  return <Badge tone={STATE_TONE[state]}>{t(state)}</Badge>;
}

/** "Free for 3 months" / "50% off on every payment" (per the coupon's first plan's period). */
export function useCouponGives() {
  const t = useTranslations('billing.coupon');
  return (c: Pick<AdminCoupon, 'percentOff' | 'billingPeriods' | 'plans'>) => {
    const deal = c.percentOff >= 100 ? t('free') : t('off', { percent: c.percentOff });
    const plan = c.plans[0];
    const when =
      c.billingPeriods == null || !plan || plan === 'BASIC'
        ? t('always')
        : t(`periods.${plan}`, { count: c.billingPeriods });
    return `${deal} ${when}`;
  };
}

/** "1 of 10 used" / "4 used, no limit". */
export function useCouponUses() {
  const t = useTranslations('admin.coupons');
  return (c: Pick<AdminCoupon, 'maxUses' | 'stats'>) =>
    c.maxUses == null
      ? t('usesUnlimited', { used: c.stats.uses })
      : t('uses', { used: c.stats.uses, max: c.maxUses });
}
