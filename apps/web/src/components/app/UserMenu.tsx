'use client';
import { Avatar, Icon, Menu, MenuItem, Modal, Text, cn, type IconName } from '@briefluence/ui';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { PreferenceFields } from '@/components/app/Preferences';
import { useDisplayCurrency } from '@/lib/hooks/currency';
import { landingPath, useConfirmLogout, type Me } from '@/lib/hooks/session';

export function displayName(me: Me) {
  return me.influencer?.displayName ?? me.brand?.companyName ?? me.email;
}

/** Where a role's Account (public profile) and Settings pages live. */
export function accountPaths(me: Me) {
  const base = me.role === 'BRAND' ? '/brand' : '/influencer';
  return { account: `${base}/account`, settings: `${base}/settings` };
}

function useLinks(me: Me, showDashboard?: boolean) {
  const t = useTranslations('nav');
  const links: { href: string; label: string; icon: IconName }[] = [];
  if (showDashboard)
    links.push({ href: landingPath(me), label: t('dashboard'), icon: 'dashboard' });
  if (me.role !== 'ADMIN') {
    const p = accountPaths(me);
    links.push({ href: p.account, label: t('account'), icon: 'user' });
    links.push({ href: p.settings, label: t('settings'), icon: 'settings' });
  }
  return links;
}

/** Second line under the name. Admins have no profile name, so the email is already the title. */
function useSubtitle(me: Me) {
  const tr = useTranslations('enums');
  return me.role === 'ADMIN' ? tr('role.ADMIN') : `${me.email} · ${tr(`role.${me.role}`)}`;
}

function Identity({ me }: { me: Me }) {
  const subtitle = useSubtitle(me);
  return (
    <div className="min-w-0">
      <Text size="small" weight="bold" truncate>
        {displayName(me)}
      </Text>
      <Text size="small" tone="muted" truncate>
        {subtitle}
      </Text>
    </div>
  );
}

/**
 * Account menu for signed-in users: Account, Settings, language, currency, sign out. A dropdown
 * from `md` up; on phones the avatar opens the same items in a bottom sheet.
 */
export function UserMenu({ me, showDashboard }: { me: Me; showDashboard?: boolean }) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const locale = useLocale();
  const logout = useConfirmLogout();
  const currency = useDisplayCurrency();
  const links = useLinks(me, showDashboard);
  const [sheet, setSheet] = useState(false);
  const subtitle = useSubtitle(me);
  const avatar = (
    <Avatar size="sm" name={displayName(me)} src={me.influencer?.avatarUrl ?? me.brand?.logoUrl} />
  );
  const item = 'flex min-h-11 w-full items-center gap-2 px-4 text-small text-ink hover:bg-surface';

  return (
    <>
      <button
        type="button"
        onClick={() => setSheet(true)}
        aria-haspopup="dialog"
        aria-label={t('account')}
        className="inline-flex min-h-11 items-center rounded-pill pl-1 pr-2 hover:bg-primary-soft/60 md:hidden"
      >
        {avatar}
      </button>
      <Modal
        open={sheet}
        onClose={() => setSheet(false)}
        title={<span className="wrap-anywhere">{displayName(me)}</span>}
        description={<span className="wrap-anywhere">{subtitle}</span>}
        closeLabel={tc('close')}
      >
        <nav aria-label={t('account')} className="-mx-5 border-b border-line pb-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setSheet(false)}
              className={cn(item, 'min-h-12 px-5 text-body')}
            >
              <Icon name={l.icon} size="md" tone="muted" /> {l.label}
              <Icon name="chevron-right" tone="muted" className="ml-auto" />
            </Link>
          ))}
        </nav>
        <PreferenceFields className="py-4" />
        <button
          type="button"
          onClick={() => {
            setSheet(false);
            void logout();
          }}
          className="-mx-5 flex min-h-12 w-[calc(100%+2.5rem)] items-center gap-2 border-t border-line px-5 pt-2 text-body font-bold text-primary-text"
        >
          <Icon name="logout" size="md" /> {t('logout')}
        </button>
      </Modal>

      <div className="hidden md:block">
        <Menu
          className="w-72"
          trigger={(p) => (
            <button
              type="button"
              onClick={p.toggle}
              aria-expanded={p['aria-expanded']}
              aria-haspopup={p['aria-haspopup']}
              aria-label={t('account')}
              className="inline-flex min-h-11 items-center gap-2 rounded-pill pl-1 pr-2 hover:bg-primary-soft/60"
            >
              {avatar}
              <span className="text-label text-ink-muted">
                {locale.toUpperCase()} · {currency}
              </span>
              <Icon name="chevron-down" tone="muted" />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="border-b border-line px-4 py-2">
                <Identity me={me} />
              </div>
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={close} className={item}>
                  <Icon name={l.icon} /> {l.label}
                </Link>
              ))}
              {/* Preferences: two selects instead of long lists; changes apply immediately. */}
              <PreferenceFields className="border-t border-line px-4 py-2" />
              <div className="border-t border-line">
                <MenuItem
                  className="min-h-11 px-4 text-small"
                  onClick={() => {
                    close();
                    void logout();
                  }}
                >
                  <Icon name="logout" /> {t('logout')}
                </MenuItem>
              </div>
            </>
          )}
        </Menu>
      </div>
    </>
  );
}
