'use client';
import { Avatar, Icon, cn, type IconName } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef, type PointerEvent } from 'react';
import { Logo } from '@/components/common/Logo';
import { useConfirmLogout, type Me } from '@/lib/hooks/session';
import { accountPaths, displayName } from './UserMenu';

export interface DrawerItem {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
}

/** iOS-like ease for the panel; items cascade in after it. */
const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]';
/** Swipe the panel left further than this (px) to close it. */
const SWIPE_CLOSE = 80;

/**
 * Phone / tablet menu: a panel that slides in from the left while the page behind shrinks a
 * little and the backdrop fades. Profile card on top, links cascading in, Log out at the bottom. Close by swiping left, tapping outside, Esc, or picking a link. Stays mounted so
 * closing animates too; `inert` keeps it out of reach while closed.
 */
export function MobileDrawer({
  open,
  onClose,
  me,
  home,
  items,
}: {
  open: boolean;
  onClose: () => void;
  me: Me;
  home: string;
  items: DrawerItem[];
}) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const tr = useTranslations('enums');
  const logout = useConfirmLogout();
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; dx: number } | null>(null);
  const paths = me.role === 'ADMIN' ? null : accountPaths(me);

  // Esc closes; the page behind does not scroll while the menu is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('a[aria-current="page"], a')?.focus({
      preventScroll: true,
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      html.style.overflow = prev;
    };
  }, [open, onClose]);

  const swipe = {
    onPointerDown(e: PointerEvent) {
      if (e.pointerType === 'mouse') return;
      drag.current = { x: e.clientX, dx: 0 };
    },
    onPointerMove(e: PointerEvent) {
      const p = panel.current;
      if (!drag.current || !p) return;
      drag.current.dx = Math.min(0, e.clientX - drag.current.x);
      if (drag.current.dx < -6) {
        p.style.transition = 'none';
        p.style.transform = `translateX(${drag.current.dx}px)`;
      }
    },
    onPointerUp() {
      const p = panel.current;
      const dx = drag.current?.dx ?? 0;
      drag.current = null;
      p?.style.removeProperty('transition');
      p?.style.removeProperty('transform');
      if (dx < -SWIPE_CLOSE) onClose();
    },
  };
  // Each row starts a little after the previous one while opening; all leave together.
  const cascade = (i: number) => ({ transitionDelay: open ? `${90 + i * 35}ms` : '0ms' });
  const row = cn(
    'transition-[opacity,translate] duration-300 motion-reduce:transition-none',
    EASE,
    open ? 'translate-x-0 opacity-100' : '-translate-x-3 opacity-0',
  );

  return (
    <div
      className={cn('fixed inset-0 z-50 lg:hidden', !open && 'pointer-events-none')}
      aria-hidden={!open}
      inert={!open}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={tc('close')}
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-ink/40 backdrop-blur-[3px] transition-opacity duration-300 motion-reduce:transition-none',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t('menu')}
        {...swipe}
        className={cn(
          'absolute inset-y-2 left-2 flex w-[min(20rem,calc(100vw-3rem))] touch-pan-y flex-col overflow-hidden rounded-[28px] bg-surface-raised shadow-pop',
          'pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]',
          'transition-transform duration-[420ms] motion-reduce:transition-none',
          EASE,
          open ? 'translate-x-0' : '-translate-x-[110%]',
        )}
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <Logo href={home} />
          <button
            type="button"
            onClick={onClose}
            aria-label={tc('close')}
            className="inline-flex size-11 items-center justify-center rounded-pill text-ink-muted hover:bg-surface"
          >
            <Icon name="close" size="md" />
          </button>
        </div>

        {/* Who is signed in: opens their Account page. */}
        <div className={cn('px-4 pt-4', row)} style={cascade(0)}>
          <Link
            href={paths?.account ?? home}
            onClick={onClose}
            className="flex items-center gap-3 rounded-card bg-primary-soft p-3"
          >
            <Avatar
              size="md"
              name={displayName(me)}
              src={me.influencer?.avatarUrl ?? me.brand?.logoUrl}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold text-ink">{displayName(me)}</span>
              <span className="block truncate text-small text-ink-muted">
                {me.role === 'ADMIN' ? tr('role.ADMIN') : me.email}
              </span>
            </span>
            <Icon name="chevron-right" tone="muted" />
          </Link>
        </div>

        <nav aria-label={t('main')} className="flex-1 overflow-y-auto px-4 py-4">
          <ul className="flex flex-col gap-1">
            {items.map((n, i) => (
              <li key={n.href} className={row} style={cascade(i + 1)}>
                <Link
                  href={n.href}
                  onClick={onClose}
                  aria-current={n.active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-pill pl-1.5 pr-4 font-bold transition-colors',
                    n.active ? 'bg-primary text-on-primary' : 'text-ink hover:bg-primary-soft/60',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex size-9 shrink-0 items-center justify-center rounded-pill',
                      n.active ? 'bg-on-primary/15' : 'bg-surface text-ink-muted ring-1 ring-line',
                    )}
                  >
                    <Icon name={n.icon} />
                  </span>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div
          className={cn('flex flex-col gap-1 border-t border-line px-4 py-3', row)}
          style={cascade(items.length + 1)}
        >
          <button
            type="button"
            onClick={() => {
              onClose();
              void logout();
            }}
            className="flex min-h-11 items-center gap-3 rounded-pill px-3 text-small font-bold text-primary-text hover:bg-surface"
          >
            <Icon name="logout" /> {t('logout')}
          </button>
        </div>
      </div>
    </div>
  );
}
