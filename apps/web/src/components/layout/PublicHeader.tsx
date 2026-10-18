'use client';
import { Button, Container, Icon, buttonStyles, cn } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { Logo } from '@/components/common/Logo';
import { UserMenu } from '@/components/app/UserMenu';
import { landingPath, useMe } from '@/lib/hooks/session';

export function PublicHeader() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const links = [
    { href: '/for-brands', label: t('forBrands') },
    { href: '/for-influencers', label: t('forInfluencers') },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label={t('main')}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'rounded-pill px-4 py-2 text-small font-bold transition-colors hover:bg-primary-soft/60',
                pathname === l.href ? 'text-primary-text' : 'text-ink-muted',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Signed in: language & currency live in the user menu; signed out: plain language button. */}
          {me ? (
            <>
              <Link
                href={landingPath(me)}
                className={buttonStyles({ size: 'sm', className: 'hidden sm:inline-flex' })}
              >
                {t('dashboard')}
              </Link>
              <UserMenu me={me} showDashboard />
            </>
          ) : (
            <>
              <LanguageSwitcher compact />
              <Link
                href="/login"
                className={buttonStyles({
                  variant: 'ghost',
                  size: 'sm',
                  className: 'hidden sm:inline-flex',
                })}
              >
                {t('login')}
              </Link>
              <Link href="/signup" className={buttonStyles({ size: 'sm' })}>
                {t('signup')}
              </Link>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={t('menu')}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? 'close' : 'menu'} size="md" />
          </Button>
        </div>
      </Container>
      {open && (
        <nav className="border-t border-line bg-surface md:hidden" aria-label={t('main')}>
          <Container className="flex flex-col py-2">
            {[...links, ...(me ? [] : [{ href: '/login', label: t('login') }])].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-sm px-2 py-3 text-body font-bold text-ink hover:bg-primary-soft/60"
              >
                {l.label}
              </Link>
            ))}
          </Container>
        </nav>
      )}
    </header>
  );
}
