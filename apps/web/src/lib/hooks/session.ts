'use client';
import type {
  Currency,
  Role,
  SubscriptionStatus,
  VerificationStatus,
  PlanCode,
} from '@briefluence/shared';
import { useConfirm } from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '../api';
import { unlinkPushFromAccount } from '../pwa';

export interface Me {
  id: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  digestEmails: boolean;
  hasPassword: boolean;
  currency: Currency;
  locale: string;
  createdAt: string;
  influencer: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    status: VerificationStatus;
    rejectionReason: string | null;
  } | null;
  brand: { id: string; companyName: string; logoUrl: string | null } | null;
  subscription: {
    status: SubscriptionStatus;
    planCode: PlanCode;
    tier: 'BASIC' | 'PRO';
    inFreeDays: boolean;
    trialEndsAt: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    trialDaysLeft: number;
    hasAccess: boolean;
  } | null;
}

export const ME_KEY = ['me'] as const;

/** Current user; `null` when signed out. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api.get<Me>('/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });
}

export const HOME_BY_ROLE: Record<Role, string> = {
  INFLUENCER: '/influencer/dashboard',
  BRAND: '/brand/dashboard',
  ADMIN: '/admin/overview',
};

/** Where to send a user right after sign-in: unfinished onboarding first. */
export function landingPath(me: Me): string {
  if (me.role === 'INFLUENCER' && !me.influencer) return '/influencer/onboarding';
  if (me.role === 'BRAND' && !me.brand) return '/brand/onboarding';
  return HOME_BY_ROLE[me.role];
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      // While still signed in, so the server knows whose device this was.
      await unlinkPushFromAccount();
      return api.post('/auth/logout');
    },
    onSettled: () => {
      qc.clear();
      router.replace('/login');
      router.refresh();
    },
  });
}

/** Log out after an "are you sure?" dialog; returns the call for menus and sheets. */
export function useConfirmLogout() {
  const logout = useLogout();
  const confirm = useConfirm();
  const t = useTranslations('common');
  return async () => {
    if (
      await confirm({
        title: t('logoutTitle'),
        description: t('logoutText'),
        confirmLabel: t('logoutConfirm'),
      })
    )
      logout.mutate();
  };
}
