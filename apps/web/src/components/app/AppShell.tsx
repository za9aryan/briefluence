'use client';
import type { Role } from '@briefluence/shared';
import { Alert, Button, Container, Icon, Spinner, Text, cn, type IconName } from '@briefluence/ui';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Logo } from '@/components/common/Logo';
import { api } from '@/lib/api';
import { HOME_BY_ROLE, useMe, type Me } from '@/lib/hooks/session';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

function useNav(role: Role): NavItem[] {
  const t = useTranslations('nav');
  if (role === 'INFLUENCER') {
    return [
      { href: '/influencer/dashboard', label: t('dashboard'), icon: 'dashboard' },
      { href: '/influencer/deals', label: t('findDeals'), icon: 'search' },
      { href: '/influencer/applications', label: t('myApplications'), icon: 'send' },
      { href: '/influencer/verification', label: t('verification'), icon: 'verified' },
      { href: '/influencer/billing', label: t('billing'), icon: 'card' },
      { href: '/influencer/account', label: t('settings'), icon: 'settings' },
    ];
  }
  if (role === 'BRAND') {
    return [
      { href: '/brand/dashboard', label: t('dashboard'), icon: 'dashboard' },
      { href: '/brand/deals', label: t('deals'), icon: 'briefcase' },
      { href: '/brand/deals/new', label: t('newDeal'), icon: 'plus' },
      { href: '/brand/insights', label: t('insights'), icon: 'chart' },
      { href: '/brand/account', label: t('brandProfile'), icon: 'building' },
    ];
  }
  return [
    { href: '/admin/verifications', label: t('admin.verifications'), icon: 'verified' },
    { href: '/admin/accounts', label: t('admin.accounts'), icon: 'link' },
    { href: '/admin/brief-review', label: t('admin.briefReview'), icon: 'shield' },
    { href: '/admin/deals', label: t('admin.deals'), icon: 'briefcase' },
    { href: '/admin/users', label: t('admin.users'), icon: 'users' },
    { href: '/admin/payments', label: t('admin.payments'), icon: 'wallet' },
  ];
}

function isActive(pathname: string, href: string, all: NavItem[]) {
  if (pathname === href) return true;
  if (all.some((n) => n.href === pathname)) return false;
  // Longest matching prefix wins, so /brand/deals/new does not also light up /brand/deals.
  const best = all
    .filter((n) => pathname.startsWith(`${n.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return best?.href === href;
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {items.map((n) => {
        const active = isActive(pathname, n.href, items);
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-pill px-4 text-small font-bold transition-colors',
                active
                  ? 'bg-primary text-on-primary'
                  : 'text-ink-muted hover:bg-primary-soft/60 hover:text-ink',
              )}
            >
              <Icon name={n.icon} />
              {n.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Banners({ me }: { me: Me }) {
  const t = useTranslations('auth');
  const tb = useTranslations('billing');
  const [resent, setResent] = useState(false);
  const resend = useMutation({
    mutationFn: () => api.post('/auth/resend-verification'),
    onSuccess: () => setResent(true),
  });
  const sub = me.subscription;
  return (
    <>
      {!me.emailVerified && me.role !== 'ADMIN' && (
        <Alert
          tone="warning"
          action={
            resent ? (
              <Text size="small" weight="bold">
                {t('resent')}
              </Text>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                loading={resend.isPending}
                onClick={() => resend.mutate()}
              >
                {t('resend')}
              </Button>
            )
          }
        >
          {me.role === 'BRAND' ? t('verifyBannerBrand') : t('verifyBannerBlogger')}
        </Alert>
      )}
      {me.role === 'INFLUENCER' && sub?.status === 'TRIALING' && sub.trialDaysLeft <= 7 && (
        <Alert
          tone="brand"
          action={
            <Link
              href="/influencer/billing"
              className="text-small font-bold text-primary-text underline"
            >
              {tb('subscribe')}
            </Link>
          }
        >
          {tb('trialBanner', { count: sub.trialDaysLeft })}
        </Alert>
      )}
      {me.role === 'INFLUENCER' && sub && !sub.hasAccess && (
        <Alert
          tone="danger"
          action={
            <Link
              href="/influencer/billing"
              className="text-small font-bold text-primary-text underline"
            >
              {tb('subscribe')}
            </Link>
          }
        >
          {tb('expiredBanner')}
        </Alert>
      )}
    </>
  );
}

/** Signed-in layout for one role: sidebar from `lg`, top bar + drawer below it. */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const { data: me, isLoading } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const items = useNav(role);
  const [drawer, setDrawer] = useState(false);

  const needsOnboarding =
    !!me &&
    ((me.role === 'INFLUENCER' && !me.influencer) || (me.role === 'BRAND' && !me.brand)) &&
    !pathname.endsWith('/onboarding');

  useEffect(() => {
    if (isLoading) return;
    if (!me) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (me.role !== role) router.replace(HOME_BY_ROLE[me.role]);
    else if (needsOnboarding)
      router.replace(role === 'BRAND' ? '/brand/onboarding' : '/influencer/onboarding');
  }, [isLoading, me, role, router, pathname, needsOnboarding]);

  useEffect(() => setDrawer(false), [pathname]);

  if (isLoading || !me || me.role !== role || needsOnboarding)
    return <Spinner label={tc('loading')} className="min-h-dvh" />;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface-raised p-4 lg:flex">
        <div className="px-2 pt-2">
          <Logo href={HOME_BY_ROLE[role]} />
        </div>
        <nav aria-label={t('main')} className="flex-1 overflow-y-auto">
          <NavLinks items={items} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
          <Container size="full" className="flex h-16 items-center justify-between gap-2">
            <div className="flex items-center gap-1 lg:hidden">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('menu')}
                aria-expanded={drawer}
                onClick={() => setDrawer(true)}
              >
                <Icon name="menu" size="md" />
              </Button>
              <Logo href={HOME_BY_ROLE[role]} />
            </div>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-1">
              <NotificationBell />
              <UserMenu me={me} />
            </div>
          </Container>
        </header>

        <main className="flex-1">
          <Container size="xl" py={{ base: 4, md: 6, lg: 8 }} className="flex flex-col gap-4">
            <Banners me={me} />
            {children}
          </Container>
        </main>
      </div>

      {/* Mobile drawer */}
      {drawer && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t('menu')}
        >
          <button
            type="button"
            aria-label={tc('close')}
            className="absolute inset-0 bg-ink/50"
            onClick={() => setDrawer(false)}
          />
          <nav className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 bg-surface-raised p-4 shadow-pop">
            <div className="flex items-center justify-between">
              <Logo href={HOME_BY_ROLE[role]} />
              <Button
                variant="ghost"
                size="icon"
                aria-label={tc('close')}
                onClick={() => setDrawer(false)}
              >
                <Icon name="close" size="md" />
              </Button>
            </div>
            <NavLinks items={items} onNavigate={() => setDrawer(false)} />
          </nav>
        </div>
      )}
    </div>
  );
}

/** Page title row: heading + optional description and actions; stacks on phones. */
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-2 inline-flex min-h-11 items-center gap-1 text-small font-bold text-primary-text hover:underline"
          >
            <Icon name="arrow-left" /> {back.label}
          </Link>
        )}
        <h1 className="text-h1 font-extrabold text-balance text-ink">{title}</h1>
        {description && <p className="mt-1 text-body text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
